#![no_std]

mod errors;
mod events;
mod types;
mod validation;
mod test_transfer_path_validation;

pub use errors::Error;
pub use types::{
    GlobalMetrics, Incentive, Material, ParticipantRole, RecyclingStats, TransferItemType,
    TransferRecord, TransferStatus, Waste, WasteTransfer, WasteType,
};

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Symbol, Vec,
};

// Storage keys
const ADMINS: Symbol = symbol_short!("ADMINS");
const CHARITY: Symbol = symbol_short!("CHARITY");
const REWARD_CFG: Symbol = symbol_short!("RWD_CFG");
const TOTAL_WEIGHT: Symbol = symbol_short!("TOT_WGT");
const TOTAL_TOKENS: Symbol = symbol_short!("TOT_TKN");
const REENTRANCY_GUARD: Symbol = symbol_short!("RE_GUARD");
const TOKEN_ADDR: Symbol = symbol_short!("TKN_ADDR");
const PART_INDEX: Symbol = symbol_short!("PART_IDX");
const PAUSED: Symbol = symbol_short!("PAUSED");

/// Reward distribution percentages stored as a single instance-storage entry.
///
/// Consolidating `collector_percentage` and `owner_percentage` into one struct
/// means a single `storage.get` call fetches both values, halving the number
/// of instance-storage lookups on every `_reward_tokens` invocation.
///
/// Migration note: contracts deployed with the old two-key layout
/// (`COL_PCT` / `OWN_PCT`) should call `set_percentages` once after upgrade
/// to write the new `RWD_CFG` key; the old keys are then unused and will
/// expire with the instance TTL.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardConfig {
    /// Percentage of total reward distributed to each collector in the transfer chain.
    pub collector_percentage: u32,
    /// Percentage of total reward distributed to the current waste owner.
    pub owner_percentage: u32,
}

/// On-chain record for a registered supply-chain participant.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Participant {
    pub address: Address,
    pub role: ParticipantRole,
    pub name: soroban_sdk::Symbol,
    /// Latitude in microdegrees (e.g. 1_000_000 = 1.0°).
    pub latitude: i128,
    /// Longitude in microdegrees.
    pub longitude: i128,
    pub is_registered: bool,
    /// Cumulative grams of waste processed.
    pub total_waste_processed: u128,
    /// Cumulative reward tokens earned.
    pub total_tokens_earned: u128,
    /// Ledger timestamp at registration.
    pub registered_at: u64,
}

/// Combined view of a participant and their recycling statistics.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ParticipantInfo {
    pub participant: Participant,
    pub stats: RecyclingStats,
}

#[contract]
pub struct ScavengerContract;

#[contractimpl]
impl ScavengerContract {
    // ========== Reentrancy Guard Functions ==========

    /// Acquire reentrancy lock
    fn lock(env: &Env) {
        if env.storage().instance().has(&REENTRANCY_GUARD) {
            panic!("Reentrant call detected");
        }
        env.storage().instance().set(&REENTRANCY_GUARD, &true);
    }

    /// Release reentrancy lock
    fn unlock(env: &Env) {
        env.storage().instance().remove(&REENTRANCY_GUARD);
    }

    // ========== Admin Functions ==========

    /// Initialise the contract administrator.
    ///
    /// Must be called exactly once, immediately after deployment.
    /// Subsequent calls panic with `"Admin already initialized"`.
    ///
    /// # Parameters
    /// - `admin`: Address that will hold admin privileges. Must sign the transaction.
    ///
    /// # Errors
    /// - Panics `"Admin already initialized"` if called more than once.
    pub fn initialize_admin(env: Env, admin: Address) {
        admin.require_auth();

        // Check if admin is already set
        if env.storage().instance().has(&ADMINS) {
            panic!("Admin already initialized");
        }

        let mut admins = Vec::new(&env);
        admins.push_back(admin);
        env.storage().instance().set(&ADMINS, &admins);
    }

    /// Get the current admin addresses.
    ///
    /// # Returns
    /// A vector of `Address`es that hold admin privileges.
    ///
    /// # Errors
    /// - Panics `"Admin not set"` if [`initialize_admin`] has not been called.
    pub fn get_admins(env: Env) -> Vec<Address> {
        env.storage().instance().get(&ADMINS).expect("Admin not set")
    }

    /// Get the primary admin address (first in the list).
    ///
    /// # Returns
    /// The `Address` of the primary contract administrator.
    ///
    /// # Errors
    /// - Panics `"Admin not set"` if [`initialize_admin`] has not been called.
    pub fn get_admin(env: Env) -> Address {
        Self::get_admins(env).first().expect("No admin found").clone()
    }

    /// Transfer admin rights to new addresses (current admin only)
    /// Replaces the entire admin list with the new list.
    pub fn transfer_admin(env: Env, current_admin: Address, new_admins: Vec<Address>) {
        Self::require_admin(&env, &current_admin);
        // Validate new_admins is not empty
        if new_admins.is_empty() {
            panic!("Admin list cannot be empty");
        }
        env.storage().instance().set(&ADMINS, &new_admins);
        events::emit_admin_transferred(&env, &current_admin);
    }

    /// Add a new admin address (current admin only)
    pub fn add_admin(env: Env, current_admin: Address, new_admin: Address) {
        Self::require_admin(&env, &current_admin);
        let mut admins: Vec<Address> = env.storage().instance().get(&ADMINS).expect("Admin not set");
        if !admins.contains(&new_admin) {
            admins.push_back(new_admin);
            env.storage().instance().set(&ADMINS, &admins);
        }
    }

    /// Remove an admin address (current admin only)
    /// Cannot remove the last admin.
    pub fn remove_admin(env: Env, current_admin: Address, admin_to_remove: Address) {
        Self::require_admin(&env, &current_admin);
        let mut admins: Vec<Address> = env.storage().instance().get(&ADMINS).expect("Admin not set");
        if admins.len() <= 1 {
            panic!("Cannot remove the last admin");
        }
        // Find and remove the admin
        let mut new_admins = Vec::new(&env);
        for admin in admins.iter() {
            if admin != admin_to_remove {
                new_admins.push_back(admin);
            }
        }
        if new_admins.len() == admins.len() {
            panic!("Admin to remove not found");
        }
        env.storage().instance().set(&ADMINS, &new_admins);
    }

    /// Check if caller is admin
    fn require_admin(env: &Env, caller: &Address) {
        let admins: Vec<Address> = env.storage().instance().get(&ADMINS).expect("Admin not set");

        if !admins.contains(caller) {
            panic!("Unauthorized: caller is not admin");
        }

        caller.require_auth();
    }


    // ========== Access Control Helper Functions ==========

    /// Verify that the caller is a registered participant
    /// Panics with "Caller is not a registered participant" if not registered
    fn only_registered(env: &Env, caller: &Address) {
        caller.require_auth();
        
        let key = (caller.clone(),);
        let participant: Option<Participant> = env.storage().instance().get(&key);
        
        match participant {
            Some(p) if p.is_registered => {},
            Some(_) => panic!("Caller is not a registered participant"),
            None => panic!("Caller is not a registered participant"),
        }
    }

    /// Verify that the caller is a registered manufacturer
    /// Panics with "Caller is not a manufacturer" if not a manufacturer
    /// Panics with "Caller is not a registered participant" if not registered
    fn only_manufacturer(env: &Env, caller: &Address) {
        caller.require_auth();
        
        let key = (caller.clone(),);
        let participant: Participant = env
            .storage()
            .instance()
            .get(&key)
            .expect("Caller is not a registered participant");
        
        if !participant.is_registered {
            panic!("Caller is not a registered participant");
        }
        
        if !participant.role.can_manufacture() {
            panic!("Caller is not a manufacturer");
        }
    }

    /// Verify that the caller is the contract administrator
    /// Panics with "Caller is not the contract admin" if not admin
    /// Panics with "Contract admin has not been set" if admin not configured
    fn only_admin(env: &Env, caller: &Address) {
        caller.require_auth();
        
        let admins: Vec<Address> = env
            .storage()
            .instance()
            .get(&ADMINS)
            .expect("Contract admin has not been set");
        
        if !admins.contains(caller) {
            panic!("Caller is not the contract admin");
        }
    }

    /// Verify that the caller owns the specified waste item
    /// Panics with "Caller is not the owner of this waste item" if not owner
    /// Panics with "Waste item not found" if waste doesn't exist
    fn only_waste_owner(env: &Env, caller: &Address, waste_id: u128) {
        caller.require_auth();
        
        let waste: Waste = env
            .storage()
            .instance()
            .get(&("waste_v2", waste_id))
            .expect("Waste item not found");
        
        if &waste.current_owner != caller {
            panic!("Caller is not the owner of this waste item");
        }
    }

    // ========== Reentrancy Guard Helper Functions ==========

    fn require_addresses_different(from: &Address, to: &Address) {
        if from == to {
            panic!("Self-transfer is not allowed");
        }
    }

    // ========== Charity Contract Functions ==========

    /// Set the charity contract address that receives donations.
    ///
    /// # Parameters
    /// - `admin`: Must be the current contract admin and sign the transaction.
    /// - `charity_address`: Target charity contract. Must differ from `admin`.
    ///
    /// # Errors
    /// - Panics `"Charity address cannot be the same as admin"`.
    /// - Panics `"Caller is not the contract admin"` if `admin` is not the admin.
    pub fn set_charity_contract(env: Env, admin: Address, charity_address: Address) {
        Self::only_admin(&env, &admin);
        
        // Validate address (basic check - address should not be the zero address)
        // In Soroban, we can't easily check for zero address, but we can ensure it's different from admin
        if charity_address == admin {
            panic!("Charity address cannot be the same as admin");
        }

        env.storage().instance().set(&CHARITY, &charity_address);
    }

    /// Get the configured charity contract address.
    ///
    /// # Returns
    /// `Some(Address)` if set, `None` otherwise.
    pub fn get_charity_contract(env: Env) -> Option<Address> {
        env.storage().instance().get(&CHARITY)
    }

    /// Donate tokens from the caller's earned balance to the charity contract.
    ///
    /// Deducts `amount` from `donor.total_tokens_earned` and emits a
    /// `donation_made` event. Protected by a reentrancy guard.
    ///
    /// # Parameters
    /// - `donor`: Registered participant making the donation. Must sign.
    /// - `amount`: Number of tokens to donate (must be > 0).
    ///
    /// # Errors
    /// - Panics `"Donation amount must be greater than zero"`.
    /// - Panics `"Insufficient balance"` if donor has fewer tokens than `amount`.
    /// - Panics `"Charity contract not set"` if no charity address is configured.
    pub fn donate_to_charity(env: Env, donor: Address, amount: i128) {
        // Reentrancy guard
        Self::lock(&env);
        Self::require_not_paused(&env);
        Self::only_registered(&env, &donor);

        // Validate amount
        if amount <= 0 {
            Self::unlock(&env);
            panic!("Donation amount must be greater than zero");
        }

        // Validate donor has enough earned token balance.
        let donor_key = (donor.clone(),);
        let mut participant: Participant = env
            .storage()
            .instance()
            .get(&donor_key)
            .expect("Caller is not a registered participant");
        let donation_amount = amount as u128;
        if participant.total_tokens_earned < donation_amount {
            Self::unlock(&env);
            panic!("Insufficient balance");
        }
        participant.total_tokens_earned -= donation_amount;
        env.storage().instance().set(&donor_key, &participant);

        // Get charity contract address
        let charity_contract = env
            .storage()
            .instance()
            .get::<Symbol, Address>(&CHARITY)
            .expect("Charity contract not set");

        // Emit donation event
        events::emit_donation_made(&env, &donor, amount, &charity_contract);

        // Release lock
        Self::unlock(&env);
    }

    // ========== Percentage Configuration Functions ==========

    /// Read the reward config in one storage lookup (internal helper).
    fn get_reward_config(env: &Env) -> RewardConfig {
        env.storage()
            .instance()
            .get(&REWARD_CFG)
            .unwrap_or(RewardConfig {
                collector_percentage: 5,
                owner_percentage: 50,
            })
    }

    /// Set both collector and owner reward percentages atomically.
    ///
    /// Persists a single [`RewardConfig`] entry so that every subsequent
    /// `_reward_tokens` call costs one storage lookup instead of two.
    /// Defaults before first call: collector = 5 %, owner = 50 %.
    ///
    /// # Parameters
    /// - `admin`: Contract admin. Must sign.
    /// - `collector_percentage`: Share (0–100) given to each collector in the chain.
    /// - `owner_percentage`: Share (0–100) given to the current waste owner.
    ///
    /// # Errors
    /// - Panics `"Total percentages cannot exceed 100"` if the sum > 100.
    ///
    /// # Example
    /// ```text
    /// set_percentages(admin, 10, 40)
    /// // collectors get 10 %, owner gets 40 %, remainder goes to recycler
    /// ```
    pub fn set_percentages(
        env: Env,
        admin: Address,
        collector_percentage: u32,
        owner_percentage: u32,
    ) {
        Self::only_admin(&env, &admin);

        if collector_percentage + owner_percentage > 100 {
            panic!("Total percentages cannot exceed 100");
        }

        env.storage().instance().set(
            &REWARD_CFG,
            &RewardConfig { collector_percentage, owner_percentage },
        );
    }

    /// Get the current collector reward percentage.
    ///
    /// Always returns `Some`; defaults to `5` if never explicitly set.
    pub fn get_collector_percentage(env: Env) -> Option<u32> {
        Some(Self::get_reward_config(&env).collector_percentage)
    }

    /// Get the current owner reward percentage.
    ///
    /// Always returns `Some`; defaults to `50` if never explicitly set.
    pub fn get_owner_percentage(env: Env) -> Option<u32> {
        Some(Self::get_reward_config(&env).owner_percentage)
    }

    /// Update only the collector percentage, preserving the owner percentage.
    ///
    /// # Parameters
    /// - `admin`: Contract admin. Must sign.
    /// - `new_percentage`: New collector share (0–100).
    ///
    /// # Errors
    /// - Panics `"Total percentages cannot exceed 100"` if `new_percentage + owner_pct > 100`.
    pub fn set_collector_percentage(env: Env, admin: Address, new_percentage: u32) {
        Self::only_admin(&env, &admin);

        let mut cfg = Self::get_reward_config(&env);
        if new_percentage + cfg.owner_percentage > 100 {
            panic!("Total percentages cannot exceed 100");
        }
        cfg.collector_percentage = new_percentage;
        env.storage().instance().set(&REWARD_CFG, &cfg);
    }

    /// Update only the owner percentage, preserving the collector percentage.
    ///
    /// # Parameters
    /// - `admin`: Contract admin. Must sign.
    /// - `new_percentage`: New owner share (0–100).
    ///
    /// # Errors
    /// - Panics `"Total percentages cannot exceed 100"` if `collector_pct + new_percentage > 100`.
    pub fn set_owner_percentage(env: Env, admin: Address, new_percentage: u32) {
        Self::only_admin(&env, &admin);

        let mut cfg = Self::get_reward_config(&env);
        if cfg.collector_percentage + new_percentage > 100 {
            panic!("Total percentages cannot exceed 100");
        }
        cfg.owner_percentage = new_percentage;
        env.storage().instance().set(&REWARD_CFG, &cfg);
    }

    // ========== Token Management Functions ==========

    /// Set the SEP-41 token contract address used for reward transfers.
    ///
    /// # Parameters
    /// - `admin`: Contract admin. Must sign.
    /// - `token_address`: Address of the token contract.
    pub fn set_token_address(env: Env, admin: Address, token_address: Address) {
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&TOKEN_ADDR, &token_address);
    }

    /// Get the configured token contract address.
    ///
    /// # Returns
    /// `Some(Address)` if set via [`set_token_address`], `None` otherwise.
    pub fn get_token_address(env: Env) -> Option<Address> {
        env.storage().instance().get(&TOKEN_ADDR)
    }

    /// Manually reward tokens to a registered recipient.
    ///
    /// Increments `recipient.total_tokens_earned` and the global token counter,
    /// then emits a `tokens_rewarded` event. Protected by a reentrancy guard.
    ///
    /// # Parameters
    /// - `rewarder`: Caller authorising the reward. Must sign.
    /// - `recipient`: Registered participant receiving the tokens.
    /// - `amount`: Token amount (must be > 0).
    /// - `waste_id`: Associated waste record ID (used in the emitted event).
    ///
    /// # Errors
    /// - Panics `"Reward amount must be greater than zero"`.
    /// - Panics `"Recipient not registered"`.
    /// - Panics `"Token address not set"` if [`set_token_address`] was not called.
    pub fn reward_tokens(
        env: Env,
        rewarder: Address,
        recipient: Address,
        amount: i128,
        waste_id: u64,
    ) {
        // Reentrancy guard
        Self::lock(&env);

        rewarder.require_auth();
        Self::require_not_paused(&env);

        // Validate amount
        if amount <= 0 {
            Self::unlock(&env);
            panic!("Reward amount must be greater than zero");
        }

        // Validate recipient is registered
        if !Self::is_participant_registered(env.clone(), recipient.clone()) {
            Self::unlock(&env);
            panic!("Recipient not registered");
        }

        // Get token address
        let token_address = env.storage().instance().get::<Symbol, Address>(&TOKEN_ADDR);

        if token_address.is_none() {
            Self::unlock(&env);
            panic!("Token address not set");
        }

        // Update recipient's total tokens earned
        let recipient_key = (recipient.clone(),);
        if let Some(mut participant) = env
            .storage()
            .instance()
            .get::<_, Participant>(&recipient_key)
        {
            participant.total_tokens_earned = participant
                .total_tokens_earned
                .checked_add(amount as u128)
                .expect("Token overflow");
            env.storage().instance().set(&recipient_key, &participant);
        }

        // Update global total tokens
        let total_tokens: u128 = env.storage().instance().get(&TOTAL_TOKENS).unwrap_or(0);
        let new_total = total_tokens
            .checked_add(amount as u128)
            .expect("Total tokens overflow");
        env.storage().instance().set(&TOTAL_TOKENS, &new_total);

        // Emit token reward event
        events::emit_tokens_rewarded(&env, &recipient, amount as u128, waste_id);

        // Release lock
        Self::unlock(&env);
    }

    // ========== Participant Storage Functions ==========

    /// Store a participant record
    /// Internal helper function for efficient participant storage
    fn set_participant(env: &Env, address: &Address, participant: &Participant) {
        let key = (address.clone(),);
        env.storage().instance().set(&key, participant);
    }

    /// Check whether an address is a registered participant.
    ///
    /// # Returns
    /// `true` if the address exists in storage and `is_registered == true`.
    pub fn is_participant_registered(env: Env, address: Address) -> bool {
        let key = (address,);
        if let Some(p) = env.storage().instance().get::<_, Participant>(&key) {
            p.is_registered
        } else {
            false
        }
    }

    /// Register a new supply-chain participant.
    ///
    /// Stores the participant on-chain and emits a `participant_registered` event.
    ///
    /// # Parameters
    /// - `address`: Participant's Stellar address. Must sign.
    /// - `role`: [`ParticipantRole`] — `Recycler`, `Collector`, or `Manufacturer`.
    /// - `name`: Short display name (Soroban `Symbol`, max 32 chars).
    /// - `latitude`: Location in microdegrees (e.g. `52_520_000` = 52.52°N).
    /// - `longitude`: Location in microdegrees.
    ///
    /// # Returns
    /// The newly created [`Participant`] record.
    ///
    /// # Errors
    /// - Panics `"Participant already registered"` on duplicate registration.
    /// - Panics on invalid coordinates (see [`validation::validate_coordinates`]).
    ///
    /// # Example
    /// ```text
    /// register_participant(alice, ParticipantRole::Recycler, "alice", 52_520_000, 13_405_000)
    /// ```
    pub fn register_participant(
        env: Env,
        address: Address,
        role: ParticipantRole,
        name: soroban_sdk::Symbol,
        latitude: i128,
        longitude: i128,
    ) -> Participant {
        Self::require_not_paused(&env);
        address.require_auth();

        // Validate coordinates
        validation::validate_coordinates(latitude, longitude);

        // Check if already registered
        if Self::is_participant_registered(env.clone(), address.clone()) {
            panic!("Participant already registered");
        }

        let participant = Participant {
            address: address.clone(),
            role,
            name: name.clone(),
            latitude,
            longitude,
            is_registered: true,
            total_waste_processed: 0,
            total_tokens_earned: 0,
            registered_at: env.ledger().timestamp(),
        };

        // Store participant using helper function
        Self::set_participant(&env, &address, &participant);

        // Add to participant index
        let mut participant_index: Vec<Address> = env
            .storage()
            .instance()
            .get(&PART_INDEX)
            .unwrap_or(Vec::new(&env));
        participant_index.push_back(address.clone());
        env.storage().instance().set(&PART_INDEX, &participant_index);

        // Emit event
        events::emit_participant_registered(
            &env,
            &address,
            role.clone(),
            name.clone(),
            latitude,
            longitude,
        );

        participant
    }

    /// Update participant statistics after processing waste
    /// Uses checked arithmetic to prevent overflow
    fn update_participant_stats(
        env: &Env,
        address: &Address,
        waste_weight: u64,
        tokens_earned: u64,
    ) {
        let key = (address.clone(),);
        if let Some(mut participant) = env.storage().instance().get::<_, Participant>(&key) {
            // Use checked arithmetic to prevent overflow
            participant.total_waste_processed = participant
                .total_waste_processed
                .checked_add(waste_weight as u128)
                .expect("Overflow in total_waste_processed");

            participant.total_tokens_earned = participant
                .total_tokens_earned
                .checked_add(tokens_earned as u128)
                .expect("Overflow in total_tokens_earned");

            env.storage().instance().set(&key, &participant);

            // Update global total tokens if tokens were earned
            if tokens_earned > 0 {
                Self::add_to_total_tokens(env, tokens_earned as u128);
            }
        }
    }

    /// Validate that a participant is registered before allowing restricted actions
    fn require_registered(env: &Env, address: &Address) {
        let key = (address.clone(),);
        let participant: Option<Participant> = env.storage().instance().get(&key);

        match participant {
            Some(p) if p.is_registered => {}
            Some(_) => panic!("Participant is not registered"),
            None => panic!("Participant not found"),
        }
    }

    /// Helper to distribute token rewards and emit events through the supply chain.
    /// Batches reads and merges writes to minimise storage round-trips.
    fn _reward_tokens(
        env: &Env,
        waste_id: u64,
        total_reward: u128,
    ) {
        if total_reward == 0 {
            return;
        }

        // One storage lookup fetches both percentages (was two separate gets)
        let cfg = Self::get_reward_config(env);
        let collector_pct = cfg.collector_percentage;
        let owner_pct = cfg.owner_percentage;

        let collector_share = (total_reward * (collector_pct as u128)) / 100;
        let owner_share = (total_reward * (owner_pct as u128)) / 100;

        // Read transfer history once
        let transfers = Self::get_transfer_history(env.clone(), waste_id);

        let mut total_distributed: u128 = 0;

        // Reward collectors — one read per unique transfer recipient
        for transfer in transfers.iter() {
            let key = (transfer.to.clone(),);
            let participant: Option<Participant> = env.storage().instance().get(&key);
            if let Some(p) = participant {
                if matches!(p.role, ParticipantRole::Collector) {
                    total_distributed += collector_share;
                    Self::update_participant_stats(env, &transfer.to, 0, collector_share as u64);
                    events::emit_tokens_rewarded(env, &transfer.to, collector_share, waste_id);
                }
            }
        }

        // Reward the current owner (submitter) — merge owner_share + remainder into one
        // read-modify-write instead of two separate calls.
        if let Some(material) = Self::get_waste_internal(env, waste_id) {
            let recycler_amount = total_reward.saturating_sub(total_distributed + owner_share);
            let submitter_total = owner_share + recycler_amount; // = total_reward - total_distributed

            if submitter_total > 0 {
                let key = (material.submitter.clone(),);
                if let Some(mut participant) = env.storage().instance().get::<_, Participant>(&key) {
                    participant.total_tokens_earned = participant
                        .total_tokens_earned
                        .checked_add(submitter_total as u128)
                        .expect("Overflow in total_tokens_earned");
                    env.storage().instance().set(&key, &participant);
                }

                // Single global-tokens update for the submitter's combined share
                Self::add_to_total_tokens(env, submitter_total as u128);

                // Emit two events to preserve existing behaviour / test expectations
                events::emit_tokens_rewarded(env, &material.submitter, owner_share, waste_id);
                if recycler_amount > 0 {
                    events::emit_tokens_rewarded(env, &material.submitter, recycler_amount, waste_id);
                }
            }
        }
    }

    /// Store a waste record by ID
    /// Internal helper function for efficient waste storage
    fn set_waste(env: &Env, waste_id: u64, material: &Material) {
        let key = ("waste", waste_id);
        env.storage().instance().set(&key, material);
    }

    /// Retrieve a waste record by ID (internal helper)
    /// Returns None if waste doesn't exist
    fn get_waste_internal(env: &Env, waste_id: u64) -> Option<Material> {
        let key = ("waste", waste_id);
        env.storage().instance().get(&key)
    }

    /// Check whether a waste record with the given ID exists.
    ///
    /// # Returns
    /// `true` if the record is present in storage.
    pub fn waste_exists(env: Env, waste_id: u64) -> bool {
        let key = ("waste", waste_id);
        env.storage().instance().has(&key)
    }

    /// Convert a [`WasteType`] variant to its human-readable string label.
    ///
    /// # Returns
    /// A Soroban `String` such as `"Plastic"` or `"Metal"`.
    pub fn get_waste_type_string(env: Env, waste_type: WasteType) -> String {
        String::from_str(&env, waste_type.as_str())
    }

    /// Convert a [`ParticipantRole`] variant to its human-readable string label.
    ///
    /// # Returns
    /// A Soroban `String` such as `"Recycler"`, `"Collector"`, or `"Manufacturer"`.
    pub fn get_participant_role_string(env: Env, role: ParticipantRole) -> String {
        String::from_str(&env, role.as_str())
    }

    /// Check whether a transfer from `from` to `to` is a permitted role transition.
    ///
    /// Valid routes:
    /// - `Recycler → Collector`
    /// - `Recycler → Manufacturer`
    /// - `Collector → Manufacturer`
    ///
    /// # Returns
    /// `true` if both participants are registered and the role transition is allowed.
    pub fn is_valid_transfer(env: &Env, from: Address, to: Address) -> bool {
        let from_participant: Option<Participant> = env.storage().instance().get(&(from,));
        let to_participant: Option<Participant> = env.storage().instance().get(&(to,));

        let (Some(from_p), Some(to_p)) = (from_participant, to_participant) else {
            return false;
        };

        if !from_p.is_registered || !to_p.is_registered {
            return false;
        }

        // Invalid if transferring to the same role
        if from_p.role == to_p.role {
            return false;
        }

        matches!(
            (from_p.role, to_p.role),
            (ParticipantRole::Recycler, ParticipantRole::Collector)
                | (ParticipantRole::Recycler, ParticipantRole::Manufacturer)
                | (ParticipantRole::Collector, ParticipantRole::Manufacturer)
        )
    }

    /// Get the total count of waste records
    fn get_waste_count(env: &Env) -> u64 {
        env.storage().instance().get(&("waste_count",)).unwrap_or(0)
    }

    /// Increment and return the next waste ID
    fn next_waste_id(env: &Env) -> u64 {
        let count = Self::get_waste_count(env);
        let next_id = count + 1;
        env.storage().instance().set(&("waste_count",), &next_id);
        next_id
    }

    /// Get the total count of incentive records
    #[allow(dead_code)]
    fn get_incentive_count(env: &Env) -> u64 {
        env.storage()
            .instance()
            .get(&("incentive_count",))
            .unwrap_or(0)
    }

    /// Increment and return the next incentive ID
    #[allow(dead_code)]
    fn next_incentive_id(env: &Env) -> u64 {
        let count = Self::get_incentive_count(env);
        let next_id = count + 1;
        env.storage()
            .instance()
            .set(&("incentive_count",), &next_id);
        next_id
    }

    /// Store an incentive record by ID
    /// Internal helper function for efficient incentive storage
    fn set_incentive(env: &Env, incentive_id: u64, incentive: &Incentive) {
        let key = ("incentive", incentive_id);
        env.storage().instance().set(&key, incentive);
    }

    /// Retrieve an incentive record by ID
    /// Returns None if incentive doesn't exist
    fn get_incentive_internal(env: &Env, incentive_id: u64) -> Option<Incentive> {
        let key = ("incentive", incentive_id);
        env.storage().instance().get(&key)
    }

    /// Retrieve an incentive by ID (internal compatibility alias).
    fn get_incentive(env: &Env, incentive_id: u64) -> Option<Incentive> {
        Self::get_incentive_internal(env, incentive_id)
    }

    /// Check whether an incentive record with the given ID exists.
    ///
    /// # Returns
    /// `true` if the record is present in storage.
    pub fn incentive_exists(env: Env, incentive_id: u64) -> bool {
        let key = ("incentive", incentive_id);
        env.storage().instance().has(&key)
    }

    /// Get global total weight
    fn get_total_weight(env: &Env) -> u64 {
        env.storage().instance().get(&TOTAL_WEIGHT).unwrap_or(0)
    }

    /// Add to global total weight
    fn add_to_total_weight(env: &Env, weight: u64) {
        let current = Self::get_total_weight(env);
        let new_total = current
            .checked_add(weight)
            .expect("Overflow in total weight");
        env.storage().instance().set(&TOTAL_WEIGHT, &new_total);
    }

    /// Get global total tokens earned
    fn get_total_tokens(env: &Env) -> u128 {
        env.storage().instance().get(&TOTAL_TOKENS).unwrap_or(0)
    }

    /// Add to global total tokens
    fn add_to_total_tokens(env: &Env, tokens: u128) {
        let current = Self::get_total_tokens(env);
        let new_total = current
            .checked_add(tokens)
            .expect("Overflow in total tokens");
        env.storage().instance().set(&TOTAL_TOKENS, &new_total);
    }

    /// Calculate total weight for active waste entries in v2 storage.
    /// Iterates once across the waste ID range to keep reads linear and allocation-free.
    fn get_total_active_waste_weight(env: &Env) -> u64 {
        let mut total_weight: u64 = 0;
        let total_wastes = Self::get_waste_count(env);

        for waste_id in 1..=total_wastes {
            if let Some(waste) = env
                .storage()
                .instance()
                .get::<_, Waste>(&("waste_v2", waste_id as u128))
            {
                if waste.is_active {
                    let weight =
                        u64::try_from(waste.weight).expect("Waste weight exceeds u64 range");
                    total_weight = total_weight
                        .checked_add(weight)
                        .expect("Overflow in active waste total weight");
                }
            }
        }

        total_weight
    }

    /// Retrieve an incentive by its numeric ID.
    ///
    /// # Returns
    /// `Some(Incentive)` if found, `None` otherwise.
    pub fn get_incentive_by_id(env: Env, incentive_id: u64) -> Option<Incentive> {
        Self::get_incentive(&env, incentive_id)
    }

    /// Toggle the active status of an incentive.
    ///
    /// Only the original `rewarder` who created the incentive may call this.
    ///
    /// # Parameters
    /// - `incentive_id`: ID of the incentive to update.
    /// - `is_active`: `true` to re-enable, `false` to pause.
    ///
    /// # Returns
    /// The updated [`Incentive`].
    ///
    /// # Errors
    /// - Panics `"Incentive not found"`.
    pub fn update_incentive_status(env: Env, incentive_id: u64, is_active: bool) -> Incentive {
        Self::require_not_paused(&env);
        let mut incentive: Incentive =
            Self::get_incentive(&env, incentive_id).expect("Incentive not found");

        // Require auth from the rewarder
        incentive.rewarder.require_auth();
        Self::require_registered(&env, &incentive.rewarder);

        incentive.active = is_active;
        Self::set_incentive(&env, incentive_id, &incentive);

        incentive
    }

    /// Update the reward points and total budget of an active incentive.
    ///
    /// Remaining budget is recalculated as `new_total_budget - budget_already_used`.
    /// If `new_total_budget` is less than the amount already spent, the incentive
    /// is automatically deactivated.
    ///
    /// # Parameters
    /// - `incentive_id`: ID of the incentive to update.
    /// - `new_reward_points`: New points per kg (must be > 0).
    /// - `new_total_budget`: New total token budget (must be > 0).
    ///
    /// # Returns
    /// The updated [`Incentive`].
    ///
    /// # Errors
    /// - Panics `"Incentive not found"`.
    /// - Panics `"Incentive is not active"`.
    /// - Panics `"Reward must be greater than zero"`.
    /// - Panics `"Total budget must be greater than zero"`.
    pub fn update_incentive(
        env: Env,
        incentive_id: u64,
        new_reward_points: u64,
        new_total_budget: u64,
    ) -> Incentive {
        Self::require_not_paused(&env);
        // Step 1: Retrieve incentive (existence check)
        let mut incentive: Incentive =
            Self::get_incentive(&env, incentive_id).expect("Incentive not found");

        // Step 2: Authorization check
        incentive.rewarder.require_auth();
        Self::require_registered(&env, &incentive.rewarder);

        // Step 3: Active status check
        if !incentive.active {
            panic!("Incentive is not active");
        }

        // Step 4: Input validation
        if new_reward_points == 0 {
            panic!("Reward must be greater than zero");
        }
        if new_total_budget == 0 {
            panic!("Total budget must be greater than zero");
        }

        // Calculate how much budget has been used
        let budget_used = incentive.total_budget - incentive.remaining_budget;

        // Step 5: Update fields (atomic)
        incentive.reward_points = new_reward_points;
        incentive.total_budget = new_total_budget;
        
        // Adjust remaining budget based on new total budget
        if new_total_budget > budget_used {
            incentive.remaining_budget = new_total_budget - budget_used;
        } else {
            incentive.remaining_budget = 0;
            incentive.active = false;
        }

        // Step 6: Persist to storage
        Self::set_incentive(&env, incentive_id, &incentive);

        // Step 7: Emit event
        env.events().publish(
            (symbol_short!("inc_upd"), incentive_id),
            (incentive.rewarder.clone(), new_reward_points, new_total_budget)
        );

        incentive
    }

    /// Calculate the token reward for a given waste amount under a specific incentive.
    ///
    /// Formula: `floor(waste_amount / 1000) * reward_points`, capped at
    /// `incentive.remaining_budget`. Returns `0` if the incentive is inactive.
    ///
    /// # Parameters
    /// - `incentive_id`: ID of the incentive to use.
    /// - `waste_amount`: Waste weight in grams.
    ///
    /// # Returns
    /// Token reward amount (`u64`). Returns `0` for inactive incentives.
    ///
    /// # Errors
    /// - Panics `"Incentive not found"`.
    pub fn calculate_incentive_reward(
        env: Env,
        incentive_id: u64,
        waste_amount: u64,
    ) -> u64 {
        let incentive: Incentive = Self::get_incentive(&env, incentive_id)
            .expect("Incentive not found");

        // Check if incentive is active
        if !incentive.active {
            return 0;
        }

        // Calculate reward: (weight in kg) * reward_points
        let weight_kg = waste_amount / 1000;
        let reward = weight_kg * incentive.reward_points;
        
        // Cap at remaining budget
        if reward > incentive.remaining_budget {
            incentive.remaining_budget
        } else {
            reward
        }
    }

    /// Get all active incentives for a specific waste type, sorted by reward descending.
    ///
    /// # Parameters
    /// - `waste_type`: The [`WasteType`] to filter by.
    ///
    /// # Returns
    /// A `Vec<Incentive>` ordered highest `reward_points` first.
    pub fn get_incentives_by_waste_type(
        env: Env,
        waste_type: WasteType,
    ) -> soroban_sdk::Vec<Incentive> {
        let mut results: soroban_sdk::Vec<Incentive> = soroban_sdk::Vec::new(&env);
        let count = Self::get_incentive_count(&env);

        for i in 1..=count {
            if let Some(incentive) = Self::get_incentive(&env, i) {
                if incentive.waste_type == waste_type && incentive.active {
                    // Keep results sorted by reward_points descending.
                    let mut inserted = false;
                    for idx in 0..results.len() {
                        if incentive.reward_points > results.get(idx).unwrap().reward_points {
                            results.insert(idx, incentive.clone());
                            inserted = true;
                            break;
                        }
                    }
                    if !inserted {
                        results.push_back(incentive);
                    }
                }
            }
        }

        results
    }

    /// Alias for [`get_incentives_by_waste_type`].
    pub fn get_incentives(env: Env, waste_type: WasteType) -> soroban_sdk::Vec<Incentive> {
        Self::get_incentives_by_waste_type(env, waste_type)
    }

    /// Get all currently active incentives across all waste types.
    ///
    /// # Returns
    /// A `Vec<Incentive>` in insertion order.
    pub fn get_active_incentives(env: Env) -> soroban_sdk::Vec<Incentive> {
        let mut results = soroban_sdk::Vec::new(&env);
        let count = Self::get_incentive_count(&env);

        for i in 1..=count {
            if let Some(incentive) = Self::get_incentive(&env, i) {
                if incentive.active {
                    results.push_back(incentive);
                }
            }
        }

        results
    }

    /// Retrieve a participant record by address.
    ///
    /// # Returns
    /// `Some(Participant)` if the address is registered, `None` otherwise.
    pub fn get_participant(env: Env, address: Address) -> Option<Participant> {
        let key = (address,);
        env.storage().instance().get(&key)
    }

    /// Get total tokens earned by a specific participant
    /// Returns the total tokens earned, or 0 for unregistered participants
    pub fn get_participant_earnings(env: Env, address: Address) -> i128 {
        let key = (address,);
        if let Some(participant) = env.storage().instance().get::<_, Participant>(&key) {
            participant.total_tokens_earned as i128
        } else {
            0
        }
    }

    /// Get participant information with current statistics
    /// Returns participant details along with their recycling statistics
    /// Returns None if participant is not registered
    /// Retrieve a participant together with their recycling statistics.
    ///
    /// # Returns
    /// `Some(ParticipantInfo)` if registered, `None` if the address is unknown.
    pub fn get_participant_info(env: Env, address: Address) -> Option<ParticipantInfo> {
        let participant = Self::get_participant(env.clone(), address.clone())?;
        let stats =
            Self::get_stats(env, address.clone()).unwrap_or_else(|| RecyclingStats::new(address));

        Some(ParticipantInfo { participant, stats })
    }

    /// Get all registered participants with pagination
    /// Returns a paginated list of participant addresses
    /// 
    /// # Arguments
    /// * `offset` - Starting index (0-based)
    /// * `limit` - Maximum number of results to return
    /// 
    /// # Returns
    /// Vector of participant addresses, limited by the specified limit
    /// Returns empty vector if offset is beyond the list size
    pub fn get_all_participants(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        let participant_index: Vec<Address> = env
            .storage()
            .instance()
            .get(&PART_INDEX)
            .unwrap_or(Vec::new(&env));

        let total_count = participant_index.len();
        let mut result = Vec::new(&env);

        // Return empty if offset is beyond the list
        if offset >= total_count {
            return result;
        }

        // Calculate the end index
        let end = core::cmp::min(offset + limit, total_count);

        // Collect addresses from offset to end
        for i in offset..end {
            if let Some(addr) = participant_index.get(i) {
                result.push_back(addr);
            }
        }

        result
    }

    /// Update participant role
    /// Preserves registration timestamp and other data
    /// Change the role of a registered participant.
    ///
    /// All other fields (name, location, stats, timestamps) are preserved.
    ///
    /// # Parameters
    /// - `address`: Participant's address. Must sign.
    /// - `new_role`: The [`ParticipantRole`] to assign.
    ///
    /// # Returns
    /// The updated [`Participant`].
    ///
    /// # Errors
    /// - Panics `"Participant not found"`.
    /// - Panics `"Participant is not registered"`.
    pub fn update_role(env: Env, address: Address, new_role: ParticipantRole) -> Participant {
        Self::require_not_paused(&env);
        address.require_auth();

        let mut participant: Participant =
            Self::get_participant(env.clone(), address.clone()).expect("Participant not found");

        // Validate participant is registered
        if !participant.is_registered {
            panic!("Participant is not registered");
        }

        participant.role = new_role;
        Self::set_participant(&env, &address, &participant);

        participant
    }

    /// Mark a participant as deregistered (`is_registered = false`).
    ///
    /// The record is retained in storage; the participant can no longer
    /// perform role-gated actions.
    ///
    /// # Parameters
    /// - `address`: Participant's address. Must sign.
    ///
    /// # Returns
    /// The updated [`Participant`] with `is_registered = false`.
    ///
    /// # Errors
    /// - Panics `"Participant not found"`.
    pub fn deregister_participant(env: Env, address: Address) -> Participant {
        Self::require_not_paused(&env);
        address.require_auth();

        let key = (address.clone(),);
        let mut participant: Participant = env
            .storage()
            .instance()
            .get(&key)
            .expect("Participant not found");

        participant.is_registered = false;
        env.storage().instance().set(&key, &participant);

        // Remove from participant index
        let participant_index: Vec<Address> = env
            .storage()
            .instance()
            .get(&PART_INDEX)
            .unwrap_or(Vec::new(&env));
        
        let mut new_index = Vec::new(&env);
        for addr in participant_index.iter() {
            if addr != address {
                new_index.push_back(addr);
            }
        }
        env.storage().instance().set(&PART_INDEX, &new_index);

        participant
    }

    /// Update participant location
    /// Update the location of a registered participant.
    /// Only the participant themselves can call this.
    /// Coordinates are scaled by 1e6 (e.g. 40_000_000 = 40.000000°).
    pub fn update_participant_location(
        env: Env,
        address: Address,
        latitude: i128,
        longitude: i128,
    ) -> Participant {
        Self::require_not_paused(&env);
        address.require_auth();

        validation::validate_coordinates(latitude, longitude);

        let key = (address.clone(),);
        let mut participant: Participant = env
            .storage()
            .instance()
            .get(&key)
            .expect("Participant not found");

        if !participant.is_registered {
            panic!("Participant is not registered");
        }

        participant.latitude = latitude;
        participant.longitude = longitude;
        env.storage().instance().set(&key, &participant);

        events::emit_participant_location_updated(&env, &address, latitude, longitude);

        participant
    }

    /// Update participant location.
    ///
    /// # Deprecated
    /// Use [`update_participant_location`] instead. That function also validates
    /// coordinates and emits a `ParticipantLocationUpdated` event.
    pub fn update_location(
        env: Env,
        address: Address,
        latitude: i128,
        longitude: i128,
    ) -> Participant {
        Self::update_participant_location(env, address, latitude, longitude)
    }

    // ========== Waste Transfer History Functions ==========

    /// Get the full transfer history for a waste item (v1 storage).
    ///
    /// Checks v2 storage first (`transfer_history` key with `u128` waste ID),
    /// then falls back to v1 (`transfers` key with `u64` waste ID).
    ///
    /// # Returns
    /// Chronologically ordered `Vec<WasteTransfer>`. Empty if no transfers recorded.
    pub fn get_transfer_history(env: Env, waste_id: u64) -> Vec<WasteTransfer> {
        // Check v2 storage first (uses u128 waste_id)
        let v2_key = ("transfer_history", waste_id as u128);
        if let Some(history) = env.storage().instance().get::<_, Vec<WasteTransfer>>(&v2_key) {
            return history;
        }
        
        // Fall back to v1 storage
        let key = ("transfers", waste_id);
        env.storage().instance().get(&key).unwrap_or(Vec::new(&env))
    }

    /// Alias for [`get_transfer_history`] — returns the full transfer log for a waste item.
    pub fn get_waste_transfer_history(env: Env, waste_id: u64) -> Vec<WasteTransfer> {
        Self::get_transfer_history(env, waste_id)
    }

    /// Get the transfer history for a v2 waste item (uses `u128` waste ID).
    ///
    /// # Returns
    /// Chronologically ordered `Vec<WasteTransfer>`. Empty if no transfers recorded.
    pub fn get_waste_transfer_history_v2(env: Env, waste_id: u128) -> Vec<WasteTransfer> {
        let key = ("transfer_history", waste_id);
        env.storage().instance().get(&key).unwrap_or(Vec::new(&env))
    }

    /// Record a waste transfer
    /// Appends to immutable history
    fn record_transfer(env: &Env, waste_id: u64, from: Address, to: Address, _note: String) {
        let key = ("transfers", waste_id);
        let mut history: Vec<WasteTransfer> =
            env.storage().instance().get(&key).unwrap_or(Vec::new(env));

        let transfer = WasteTransfer::new(
            waste_id as u128,
            from,
            to,
            env.ledger().timestamp(),
            0,
            0,
            soroban_sdk::symbol_short!("note"),
        );

        history.push_back(transfer);
        env.storage().instance().set(&key, &history);
    }

    /// Transfer waste ownership from one participants to another
    /// Transfer waste ownership (v1 — u64 waste IDs, String note).
    ///
    /// # Deprecated
    /// Use [`transfer_waste_v2`] instead. v2 uses u128 waste IDs, records
    /// GPS coordinates, validates transfer routes, and maintains the
    /// `participant_wastes` index. This function is kept for backward
    /// compatibility and will be removed in a future release.
    ///
    /// Migration: replace `transfer_waste(id, from, to, note)` with
    /// `transfer_waste_v2(id as u128, from, to, latitude, longitude)`.
    pub fn transfer_waste(
        env: Env,
        waste_id: u64,
        from: Address,
        to: Address,
        note: String,
    ) -> Material {
        from.require_auth();

        Self::require_not_paused(&env);
        Self::require_registered(&env, &from);
        Self::require_registered(&env, &to);

        let mut material: Material =
            Self::get_waste_internal(&env, waste_id).expect("Waste not found");

        if material.submitter != from {
            panic!("Only waste owner can transfer");
        }

        assert!(from != to, "Cannot transfer waste to self");

        // Align with v2: reject transfers on deactivated waste
        // Note: Material doesn't have is_active, assuming active for deprecated function
        // if !material.is_active {
        //     panic!("Cannot transfer deactivated waste");
        // }

        // Align with v2: enforce valid transfer routes
        if !Self::is_valid_transfer(&env, from.clone(), to.clone()) {
            panic!("Invalid transfer: role combination not allowed");
        }

        material.submitter = to.clone();
        Self::set_waste(&env, waste_id, &material);

        events::emit_waste_transferred(&env, waste_id, &from, &to);
        Self::record_transfer(&env, waste_id, from, to, note);

        material
    }

    /// Get all outbound transfers for a participant.
    ///
    /// > **Note:** Currently returns an empty list. A sender index is required
    /// > for efficient lookup and is not yet implemented.
    pub fn get_transfers_from(env: Env, _address: Address) -> Vec<(u64, Vec<WasteTransfer>)> {
        // Note: This is a simplified implementation
        // In production, you'd want to maintain an index for efficient queries
        // This would need to iterate through all wastes
        // For now, returning empty as this requires additional indexing
        Vec::new(&env)
    }

    /// Get all inbound transfers for a participant.
    ///
    /// > **Note:** Currently returns an empty list. A receiver index is required
    /// > for efficient lookup and is not yet implemented.
    pub fn get_transfers_to(env: Env, _address: Address) -> Vec<(u64, Vec<WasteTransfer>)> {
        // Note: This is a simplified implementation
        // In production, you'd want to maintain an index for efficient queries
        // This would need to iterate through all wastes
        // For now, returning empty as this requires additional indexing
        Vec::new(&env)
    }

    /// Check whether a participant is permitted to collect waste materials.
    ///
    /// # Returns
    /// `true` if the participant is registered and their role allows collection
    /// (`Recycler` or `Collector`).
    pub fn can_collect(env: Env, address: Address) -> bool {
        let key = (address,);
        if let Some(participant) = env.storage().instance().get::<_, Participant>(&key) {
            participant.is_registered && participant.role.can_collect_materials()
        } else {
            false
        }
    }

    /// Check whether a participant is permitted to manufacture products.
    ///
    /// # Returns
    /// `true` if the participant is registered and their role is `Manufacturer`.
    pub fn can_manufacture(env: Env, address: Address) -> bool {
        let key = (address,);
        if let Some(participant) = env.storage().instance().get::<_, Participant>(&key) {
            participant.is_registered && participant.role.can_manufacture()
        } else {
            false
        }
    }

    /// Submit a single waste material for recycling (v1 API).
    ///
    /// Creates a [`Material`] record, updates the submitter's recycling stats,
    /// and increments the global weight counter.
    ///
    /// # Parameters
    /// - `waste_type`: Category of the material (e.g. `Plastic`, `Metal`).
    /// - `weight`: Weight in grams (must be > 0 for meaningful rewards).
    /// - `submitter`: Registered participant submitting the material. Must sign.
    /// - `description`: Free-text description of the material.
    ///
    /// # Returns
    /// The newly created [`Material`] record with a unique `id`.
    ///
    /// # Errors
    /// - Panics `"Caller is not a registered participant"` if `submitter` is not registered.
    pub fn submit_material(
        env: Env,
        waste_type: WasteType,
        weight: u64,
        submitter: Address,
        description: String,
    ) -> Material {
        // Validate submitter is registered
        Self::require_not_paused(&env);
        Self::only_registered(&env, &submitter);

        // Get next waste ID using the new storage system
        let waste_id = Self::next_waste_id(&env);

        // Create material
        let material = Material::new(
            waste_id,
            waste_type,
            weight,
            submitter.clone(),
            env.ledger().timestamp(),
            description,
        );

        // Store waste using the new storage systems
        Self::set_waste(&env, waste_id, &material);

        // Update stats
        let mut stats: RecyclingStats = env
            .storage()
            .instance()
            .get(&("stats", submitter.clone()))
            .unwrap_or_else(|| RecyclingStats::new(submitter.clone()));

        stats.record_submission(&material);
        env.storage()
            .instance()
            .set(&("stats", submitter.clone()), &stats);

        // Update participant stats
        Self::update_participant_stats(&env, &submitter, weight, 0);

        // Update global total weight
        Self::add_to_total_weight(&env, weight);

        material
    }

    /// Register a new waste item with GPS location data (v2 API).
    ///
    /// Stores the waste in the v2 storage layout and appends its ID to the
    /// recycler's waste list. Emits a `waste_registered` event.
    ///
    /// # Parameters
    /// - `waste_type`: Category of the waste.
    /// - `weight`: Weight in grams (must be > 0).
    /// - `recycler`: Registered participant creating the record. Must sign.
    /// - `latitude`: Collection latitude in microdegrees.
    /// - `longitude`: Collection longitude in microdegrees.
    ///
    /// # Returns
    /// The new waste ID (`u128`).
    ///
    /// # Errors
    /// - Panics `"Waste weight must be greater than zero"`.
    /// - Panics `"Caller is not a registered participant"`.
    pub fn recycle_waste(
        env: Env,
        waste_type: WasteType,
        weight: u128,
        recycler: Address,
        latitude: i128,
        longitude: i128,
    ) -> u128 {
        // Validate recycler is registered
        Self::require_not_paused(&env);
        Self::only_registered(&env, &recycler);

        if weight == 0 {
            panic!("Waste weight must be greater than zero");
        }

        let waste_id = Self::next_waste_id(&env) as u128;
        let timestamp = env.ledger().timestamp();

        let waste = types::Waste::new(
            waste_id,
            waste_type,
            weight,
            recycler.clone(),
            latitude,
            longitude,
            timestamp,
            true,
            false,
            recycler.clone(),
        );

        env.storage()
            .instance()
            .set(&("waste_v2", waste_id), &waste);

        let mut waste_list: Vec<u128> = env
            .storage()
            .instance()
            .get(&("participant_wastes", recycler.clone()))
            .unwrap_or(Vec::new(&env));
        waste_list.push_back(waste_id);
        env.storage()
            .instance()
            .set(&("participant_wastes", recycler.clone()), &waste_list);

        // Emit waste registered event
        events::emit_waste_registered(
            &env, waste_id, &recycler, waste_type, weight, latitude, longitude,
        );

        waste_id
    }

    /// Retrieve a v2 waste record by its `u128` ID.
    ///
    /// # Returns
    /// `Some(Waste)` if found, `None` otherwise.
    pub fn get_waste_v2(env: Env, waste_id: u128) -> Option<types::Waste> {
        env.storage().instance().get(&("waste_v2", waste_id))
    }

    /// Get all v2 waste IDs currently owned by a participant.
    ///
    /// # Returns
    /// `Vec<u128>` of waste IDs. Empty if the participant owns none.
    pub fn get_participant_wastes_v2(env: Env, participant: Address) -> Vec<u128> {
        env.storage()
            .instance()
            .get(&("participant_wastes", participant))
            .unwrap_or(Vec::new(&env))
    }

    /// Transfer a v2 waste item between participants with location tracking.
    ///
    /// Validates the role-based transfer route, updates ownership, adjusts both
    /// participants' waste lists, appends to transfer history, and emits a
    /// `transfer` event.
    ///
    /// # Parameters
    /// - `waste_id`: ID of the v2 waste to transfer.
    /// - `from`: Current owner. Must sign and own the waste.
    /// - `to`: New owner. Must be registered.
    /// - `latitude`: Transfer location latitude in microdegrees.
    /// - `longitude`: Transfer location longitude in microdegrees.
    ///
    /// # Returns
    /// The [`WasteTransfer`] record that was appended to history.
    ///
    /// # Errors
    /// - [`Error::WasteNotFound`] if no waste record exists for `waste_id`.
    /// - [`Error::WasteDeactivated`] if the waste item is deactivated.
    /// - [`Error::InvalidTransferRoute`] if the role transition is not permitted.
    /// - Panics `"Caller is not the owner of this waste item"`.
    pub fn transfer_waste_v2(
        env: Env,
        waste_id: u128,
        from: Address,
        to: Address,
        latitude: i128,
        longitude: i128,
    ) -> Result<WasteTransfer, Error> {
        from.require_auth();
        Self::require_not_paused(&env);
        Self::require_addresses_different(&from, &to);

        // Fetch waste first so we can return a typed error if not found
        let mut waste: types::Waste = match env
            .storage()
            .instance()
            .get(&("waste_v2", waste_id))
        {
            Some(w) => w,
            None => return Err(Error::WasteNotFound),
        };

        // Verify caller owns the waste
        if waste.current_owner != from {
            panic!("Caller is not the owner of this waste item");
        }

        Self::require_registered(&env, &from);
        Self::require_registered(&env, &to);

        if !waste.is_active {
            return Err(Error::WasteDeactivated);
        }

        // Route check after registration checks, before any storage mutation
        if !Self::is_valid_transfer(&env, from.clone(), to.clone()) {
            return Err(Error::InvalidTransferRoute);
        }

        waste.transfer_to(to.clone());
        env.storage()
            .instance()
            .set(&("waste_v2", waste_id), &waste);

        let from_list: Vec<u128> = env
            .storage()
            .instance()
            .get(&("participant_wastes", from.clone()))
            .unwrap_or(Vec::new(&env));
        let mut new_from_list = Vec::new(&env);
        for id in from_list.iter() {
            if id != waste_id {
                new_from_list.push_back(id);
            }
        }
        env.storage()
            .instance()
            .set(&("participant_wastes", from.clone()), &new_from_list);

        let mut to_list: Vec<u128> = env
            .storage()
            .instance()
            .get(&("participant_wastes", to.clone()))
            .unwrap_or(Vec::new(&env));
        to_list.push_back(waste_id);
        env.storage()
            .instance()
            .set(&("participant_wastes", to.clone()), &to_list);

        let timestamp = env.ledger().timestamp();
        let transfer = WasteTransfer::new(
            waste_id,
            from.clone(),
            to.clone(),
            timestamp,
            latitude,
            longitude,
            soroban_sdk::symbol_short!("transfer"),
        );

        let mut history: Vec<WasteTransfer> = env
            .storage()
            .instance()
            .get(&("transfer_history", waste_id))
            .unwrap_or(Vec::new(&env));
        history.push_back(transfer.clone());
        env.storage()
            .instance()
            .set(&("transfer_history", waste_id), &history);

        env.events().publish(
            (soroban_sdk::symbol_short!("transfer"), waste_id),
            (from, to, timestamp),
        );

        Ok(transfer)
    }

    /// Batch transfer multiple waste items to a single recipient
    /// All waste IDs are validated before any transfer is executed (atomic validation)
    /// Emits individual transfer events for each waste item
    pub fn batch_transfer_waste(
        env: Env,
        waste_ids: Vec<u128>,
        to: Address,
        latitude: i128,
        longitude: i128,
    ) -> Result<Vec<WasteTransfer>, Error> {
        // Validate recipient is registered
        Self::require_not_paused(&env);
        Self::require_registered(&env, &to);

        // Handle empty batch
        if waste_ids.is_empty() {
            return Ok(Vec::new(&env));
        }

        // Phase 1: Validate all waste IDs before executing any transfer
        let mut wastes_to_transfer: soroban_sdk::Vec<(u128, types::Waste, Address)> = soroban_sdk::Vec::new(&env);
        
        for waste_id in waste_ids.iter() {
            let waste: types::Waste = env
                .storage()
                .instance()
                .get(&("waste_v2", waste_id))
                .ok_or(Error::WasteNotFound)?;

            // Verify waste is active
            if !waste.is_active {
                return Err(Error::WasteDeactivated);
            }

            // Get the current owner
            let from = waste.current_owner.clone();

            if from == to {
                return Err(Error::SameAddress);
            }
            // Verify caller owns the waste
            Self::only_waste_owner(&env, &from, waste_id);
            Self::require_registered(&env, &from);

            // Validate transfer route
            if !Self::is_valid_transfer(&env, from.clone(), to.clone()) {
                return Err(Error::InvalidTransferRoute);
            }

            wastes_to_transfer.push_back((waste_id, waste, from));
        }

        // Phase 2: Execute all transfers (all validations passed)
        let mut transfers: Vec<WasteTransfer> = Vec::new(&env);
        let timestamp = env.ledger().timestamp();

        for item in wastes_to_transfer.iter() {
            let (waste_id, mut waste, from) = item;

            // Update waste ownership
            waste.transfer_to(to.clone());
            env.storage()
                .instance()
                .set(&("waste_v2", waste_id), &waste);

            // Update from participant's waste list
            let from_list: Vec<u128> = env
                .storage()
                .instance()
                .get(&("participant_wastes", from.clone()))
                .unwrap_or(Vec::new(&env));
            let mut new_from_list = Vec::new(&env);
            for id in from_list.iter() {
                if id != waste_id {
                    new_from_list.push_back(id);
                }
            }
            env.storage()
                .instance()
                .set(&("participant_wastes", from.clone()), &new_from_list);

            // Update to participant's waste list
            let mut to_list: Vec<u128> = env
                .storage()
                .instance()
                .get(&("participant_wastes", to.clone()))
                .unwrap_or(Vec::new(&env));
            to_list.push_back(waste_id);
            env.storage()
                .instance()
                .set(&("participant_wastes", to.clone()), &to_list);

            // Create transfer record
            let transfer = WasteTransfer::new(
                waste_id,
                from.clone(),
                to.clone(),
                timestamp,
                latitude,
                longitude,
                soroban_sdk::symbol_short!("transfer"),
            );

            // Update transfer history
            let mut history: Vec<WasteTransfer> = env
                .storage()
                .instance()
                .get(&("transfer_history", waste_id))
                .unwrap_or(Vec::new(&env));
            history.push_back(transfer.clone());
            env.storage()
                .instance()
                .set(&("transfer_history", waste_id), &history);

            // Emit individual transfer event
            env.events().publish(
                (soroban_sdk::symbol_short!("transfer"), waste_id),
                (from, to.clone(), timestamp),
            );

            transfers.push_back(transfer);
        }

        Ok(transfers)
    }

    /// Transfer aggregated waste from collector to manufacturer
    /// Transfer aggregated waste from a collector directly to a manufacturer.
    ///
    /// Creates a new v2 waste record owned by `manufacturer`, records the
    /// transfer, and emits a `bulk_xfr` event. Useful for bulk handoffs where
    /// individual waste IDs are not tracked.
    ///
    /// # Parameters
    /// - `waste_type`: Type of the aggregated waste.
    /// - `collector`: Registered `Collector`. Must sign.
    /// - `manufacturer`: Registered `Manufacturer` receiving the waste.
    /// - `latitude` / `longitude`: Handoff location in microdegrees.
    /// - `notes`: Short symbol note attached to the transfer record.
    ///
    /// # Returns
    /// The new waste ID (`u128`).
    ///
    /// # Errors
    /// - Panics `"Only collectors can use this"`.
    /// - Panics `"Recipient must be manufacturer"`.
    pub fn transfer_collected_waste(
        env: Env,
        waste_type: WasteType,
        collector: Address,
        manufacturer: Address,
        latitude: i128,
        longitude: i128,
        notes: soroban_sdk::Symbol,
    ) -> u128 {
        collector.require_auth();
        Self::require_not_paused(&env);
        Self::require_registered(&env, &collector);
        Self::require_registered(&env, &manufacturer);

        let collector_key = (collector.clone(),);
        let collector_participant: Participant = env
            .storage()
            .instance()
            .get(&collector_key)
            .expect("Collector not registered");

        if collector_participant.role != ParticipantRole::Collector {
            panic!("Only collectors can use this");
        }

        let manufacturer_key = (manufacturer.clone(),);
        let manufacturer_participant: Participant = env
            .storage()
            .instance()
            .get(&manufacturer_key)
            .expect("Manufacturer not registered");

        if manufacturer_participant.role != ParticipantRole::Manufacturer {
            panic!("Recipient must be manufacturer");
        }

        let waste_id = Self::next_waste_id(&env) as u128;
        let timestamp = env.ledger().timestamp();

        let waste = types::Waste::new(
            waste_id,
            waste_type,
            0,
            manufacturer.clone(),
            latitude,
            longitude,
            timestamp,
            true,
            false,
            manufacturer.clone(),
        );

        env.storage()
            .instance()
            .set(&("waste_v2", waste_id), &waste);

        let mut manufacturer_list: Vec<u128> = env
            .storage()
            .instance()
            .get(&("participant_wastes", manufacturer.clone()))
            .unwrap_or(Vec::new(&env));
        manufacturer_list.push_back(waste_id);
        env.storage().instance().set(
            &("participant_wastes", manufacturer.clone()),
            &manufacturer_list,
        );

        let transfer = WasteTransfer::new(
            waste_id,
            collector.clone(),
            manufacturer.clone(),
            timestamp,
            latitude,
            longitude,
            notes,
        );

        let mut history: Vec<WasteTransfer> = env
            .storage()
            .instance()
            .get(&("transfer_history", waste_id))
            .unwrap_or(Vec::new(&env));
        history.push_back(transfer);
        env.storage()
            .instance()
            .set(&("transfer_history", waste_id), &history);

        env.events().publish(
            (soroban_sdk::symbol_short!("bulk_xfr"), waste_id),
            (collector, manufacturer, waste_type, timestamp),
        );

        waste_id
    }

    /// Confirm receipt of a v2 waste item.
    ///
    /// A participant other than the current owner calls this to acknowledge
    /// the waste. Emits a `waste_confirmed` event.
    ///
    /// # Parameters
    /// - `waste_id`: ID of the v2 waste to confirm.
    /// - `confirmer`: Registered participant confirming receipt. Must sign.
    ///   Must **not** be the current owner.
    ///
    /// # Returns
    /// The updated [`Waste`] with `is_confirmed = true`.
    ///
    /// # Errors
    /// - Panics `"Waste not found"`.
    /// - Panics `"Cannot confirm deactivated waste"`.
    /// - Panics `"Owner cannot confirm own waste"`.
    /// - Panics `"Waste already confirmed"`.
    pub fn confirm_waste_details(env: Env, waste_id: u128, confirmer: Address) -> types::Waste {
        Self::require_not_paused(&env);
        confirmer.require_auth();
        Self::require_registered(&env, &confirmer);

        let mut waste: types::Waste = env
            .storage()
            .instance()
            .get(&("waste_v2", waste_id))
            .expect("Waste not found");

        if !waste.is_active {
            panic!("Cannot confirm deactivated waste");
        }

        if waste.current_owner == confirmer {
            panic!("Owner cannot confirm own waste");
        }

        if waste.is_confirmed {
            panic!("Waste already confirmed");
        }

        waste.confirm(confirmer.clone());
        env.storage()
            .instance()
            .set(&("waste_v2", waste_id), &waste);

        events::emit_waste_confirmed(&env, waste_id, &confirmer);

        waste
    }

    /// Reset the confirmation status of a v2 waste item.
    ///
    /// Only the current owner may reset confirmation, allowing the item to be
    /// re-confirmed after a dispute or correction.
    ///
    /// # Parameters
    /// - `waste_id`: ID of the v2 waste.
    /// - `owner`: Current owner. Must sign.
    ///
    /// # Returns
    /// The updated [`Waste`] with `is_confirmed = false`.
    ///
    /// # Errors
    /// - Panics `"Waste item not found"`.
    /// - Panics `"Waste is not confirmed"`.
    /// - Panics `"Caller is not the owner of this waste item"`.
    pub fn reset_waste_confirmation(
        env: Env,
        waste_id: u128,
        owner: Address,
    ) -> types::Waste {
        Self::require_not_paused(&env);
        // Access control check - verify caller owns the waste
        Self::only_waste_owner(&env, &owner, waste_id);
        Self::require_registered(&env, &owner);

        let mut waste: types::Waste = env
            .storage()
            .instance()
            .get(&("waste_v2", waste_id))
            .expect("Waste item not found");

        if !waste.is_confirmed {
            panic!("Waste is not confirmed");
        }

        waste.reset_confirmation();
        env.storage()
            .instance()
            .set(&("waste_v2", waste_id), &waste);

        env.events().publish(
            (soroban_sdk::symbol_short!("reset"), waste_id),
            (owner, env.ledger().timestamp()),
        );

        waste
    }

    /// Permanently deactivate a v2 waste record (admin only).
    ///
    /// Deactivated waste cannot be transferred or confirmed. The operation is
    /// irreversible.
    ///
    /// # Parameters
    /// - `waste_id`: ID of the v2 waste to deactivate.
    /// - `admin`: Contract admin. Must sign.
    ///
    /// # Returns
    /// The updated [`Waste`] with `is_active = false`.
    ///
    /// # Errors
    /// - Panics `"Waste item not found"`.
    /// - Panics `"Waste already deactivated"`.
    pub fn deactivate_waste(
        env: Env,
        waste_id: u128,
        admin: Address,
    ) -> types::Waste {
        Self::only_admin(&env, &admin);

        let mut waste: types::Waste = env
            .storage()
            .instance()
            .get(&("waste_v2", waste_id))
            .expect("Waste item not found");

        if !waste.is_active {
            panic!("Waste already deactivated");
        }

        waste.deactivate();
        env.storage()
            .instance()
            .set(&("waste_v2", waste_id), &waste);

        env.events().publish(
            (soroban_sdk::symbol_short!("deactive"), waste_id),
            (admin, env.ledger().timestamp()),
        );

        waste
    }

    /// Submit multiple waste materials in a single transaction (v1 API).
    ///
    /// More gas-efficient than repeated [`submit_material`] calls because stats
    /// and storage writes are batched. Emits no individual events per item.
    ///
    /// # Parameters
    /// - `materials`: Vec of `(WasteType, weight_grams, description)` tuples.
    /// - `submitter`: Registered participant. Must sign.
    ///
    /// # Returns
    /// `Vec<Material>` in the same order as the input.
    ///
    /// # Errors
    /// - Panics `"Caller is not a registered participant"`.
    /// - Panics `"Overflow in batch weight"` on u64 overflow.
    pub fn submit_materials_batch(
        env: Env,
        materials: soroban_sdk::Vec<(WasteType, u64, String)>,
        submitter: Address,
    ) -> soroban_sdk::Vec<Material> {
        // Validate submitter is registered
        Self::require_not_paused(&env);
        Self::only_registered(&env, &submitter);

        let mut results = soroban_sdk::Vec::new(&env);
        let timestamp = env.ledger().timestamp();

        // Get or create stats once
        let mut stats: RecyclingStats = env
            .storage()
            .instance()
            .get(&("stats", submitter.clone()))
            .unwrap_or_else(|| RecyclingStats::new(submitter.clone()));

        let mut total_weight: u64 = 0;

        // Process each material
        for item in materials.iter() {
            let (waste_type, weight, description) = item;
            let waste_id = Self::next_waste_id(&env);

            let material = Material::new(
                waste_id,
                waste_type,
                weight,
                submitter.clone(),
                timestamp,
                description,
            );

            Self::set_waste(&env, waste_id, &material);
            stats.record_submission(&material);
            results.push_back(material);

            // Accumulate weight with overflow check
            total_weight = total_weight
                .checked_add(weight)
                .expect("Overflow in batch weight");
        }

        // Update stats once at the end
        env.storage()
            .instance()
            .set(&("stats", submitter.clone()), &stats);

        // Update participant stats
        Self::update_participant_stats(&env, &submitter, total_weight, 0);

        results
    }

    /// Retrieve a v1 material record by ID. Alias for [`get_waste`].
    pub fn get_material(env: Env, material_id: u64) -> Option<Material> {
        Self::get_waste(env, material_id)
    }

    /// Get waste by ID (alias for backward compatibility)
    ///
    /// # Deprecated
    /// Use [`get_waste`] instead. This function is an exact alias and will be
    /// removed in a future release.
    pub fn get_waste_by_id(env: Env, waste_id: u64) -> Option<Material> {
        Self::get_waste(env, waste_id)
    }

    /// Retrieve a v1 waste/material record by ID.
    ///
    /// # Returns
    /// `Some(Material)` if found, `None` otherwise.
    pub fn get_waste(env: Env, waste_id: u64) -> Option<Material> {
        let key = ("waste", waste_id);
        env.storage().instance().get(&key)
    }

    /// Get all v1 waste IDs currently owned by a participant.
    ///
    /// Performs a linear scan over all waste records. For large datasets,
    /// prefer [`get_participant_wastes_v2`] which uses an indexed list.
    ///
    /// # Returns
    /// `Vec<u64>` of waste IDs where `material.submitter == participant`.
    pub fn get_participant_wastes(env: Env, participant: Address) -> Vec<u64> {
        let mut waste_ids = Vec::new(&env);
        let waste_count = env
            .storage()
            .instance()
            .get::<_, u64>(&("waste_count",))
            .unwrap_or(0);

        // Iterate through all wastes and collect IDs owned by participant
        for waste_id in 1..=waste_count {
            let key = ("waste", waste_id);
            if let Some(material) = env.storage().instance().get::<_, Material>(&key) {
                if material.submitter == participant {
                    waste_ids.push_back(waste_id);
                }
            }
        }

        waste_ids
    }

    /// Retrieve multiple v1 waste records in a single call.
    ///
    /// # Parameters
    /// - `waste_ids`: Vec of waste IDs to fetch.
    ///
    /// # Returns
    /// `Vec<Option<Material>>` in the same order as `waste_ids`.
    /// Each element is `None` if the corresponding ID does not exist.
    pub fn get_wastes_batch(
        env: Env,
        waste_ids: soroban_sdk::Vec<u64>,
    ) -> soroban_sdk::Vec<Option<Material>> {
        let mut results = soroban_sdk::Vec::new(&env);

        for waste_id in waste_ids.iter() {
            results.push_back(Self::get_waste_internal(&env, waste_id));
        }

        results
    }

    /// Verify a submitted material and distribute token rewards.
    ///
    /// Marks the material as verified, calculates reward points based on weight
    /// and waste type, then distributes shares to collectors, the current owner,
    /// and the recycler remainder via `_reward_tokens`.
    ///
    /// # Parameters
    /// - `material_id`: ID of the v1 material to verify.
    /// - `verifier`: Registered `Recycler`. Must sign.
    ///
    /// # Returns
    /// The updated [`Material`] with `verified = true`.
    ///
    /// # Errors
    /// - Panics `"Verifier not registered"` / `"Verifier is not registered"`.
    /// - Panics `"Only recyclers can verify materials"`.
    /// - Panics `"Material not found"`.
    pub fn verify_material(env: Env, material_id: u64, verifier: Address) -> Material {
        Self::require_not_paused(&env);
        verifier.require_auth();

        // Check if verifier is a recycler and is registered
        let verifier_key = (verifier.clone(),);
        let participant: Participant = env
            .storage()
            .instance()
            .get(&verifier_key)
            .expect("Verifier not registered");

        if !participant.is_registered {
            panic!("Verifier is not registered");
        }

        if !participant.role.can_process_recyclables() {
            panic!("Only recyclers can verify materials");
        }

        // Get and verify material using new storage system
        let mut material: Material =
            Self::get_waste_internal(&env, material_id).expect("Material not found");

        material.verify();
        Self::set_waste(&env, material_id, &material);

        // Calculate tokens earned
        let tokens_earned = material.calculate_reward_points();

        // Update submitter stats
        let mut stats: RecyclingStats = env
            .storage()
            .instance()
            .get(&("stats", material.submitter.clone()))
            .unwrap_or_else(|| RecyclingStats::new(material.submitter.clone()));

        stats.record_verification(&material);
        env.storage()
            .instance()
            .set(&("stats", material.submitter.clone()), &stats);

        // Distribute token rewards using the helper which also emits TOKENS_REWARDED events
        Self::_reward_tokens(&env, material_id, tokens_earned as u128);

        material
    }

    /// Verify multiple materials in a single transaction.
    ///
    /// Skips any IDs that do not exist. For each verified material, reward
    /// tokens are distributed and a `tokens_rewarded` event is emitted.
    ///
    /// # Parameters
    /// - `material_ids`: Vec of v1 material IDs to verify.
    /// - `verifier`: Registered `Recycler`. Must sign.
    ///
    /// # Returns
    /// `Vec<Material>` containing only the materials that were found and verified.
    ///
    /// # Errors
    /// - Panics `"Verifier not registered"` / `"Only recyclers can verify materials"`.
    pub fn verify_materials_batch(
        env: Env,
        material_ids: soroban_sdk::Vec<u64>,
        verifier: Address,
    ) -> soroban_sdk::Vec<Material> {
        Self::require_not_paused(&env);
        verifier.require_auth();

        // Check if verifier is a recycler and is registered
        let verifier_key = (verifier.clone(),);
        let participant: Participant = env
            .storage()
            .instance()
            .get(&verifier_key)
            .expect("Verifier not registered");

        if !participant.is_registered {
            panic!("Verifier is not registered");
        }

        if !participant.role.can_process_recyclables() {
            panic!("Only recyclers can verify materials");
        }

        let mut results = soroban_sdk::Vec::new(&env);

        for material_id in material_ids.iter() {
            if let Some(mut material) = Self::get_waste_internal(&env, material_id) {
                material.verify();
                Self::set_waste(&env, material_id, &material);

                // Calculate tokens earned
                let tokens_earned = material.calculate_reward_points();

                // Update submitter stats
                let mut stats: RecyclingStats = env
                    .storage()
                    .instance()
                    .get(&("stats", material.submitter.clone()))
                    .unwrap_or_else(|| RecyclingStats::new(material.submitter.clone()));

                stats.record_verification(&material);
                env.storage()
                    .instance()
                    .set(&("stats", material.submitter.clone()), &stats);

                // Distribute token rewards using the helper which also emits TOKENS_REWARDED events
                Self::_reward_tokens(&env, material_id, tokens_earned as u128);

                results.push_back(material);
            }
        }

        results
    }

    /// Get recycling statistics for a participant.
    ///
    /// # Returns
    /// `Some(RecyclingStats)` if the participant has submitted or verified
    /// at least one material, `None` otherwise.
    pub fn get_stats(env: Env, participant: Address) -> Option<RecyclingStats> {
        env.storage().instance().get(&("stats", participant))
    }

    /// Get global supply-chain statistics.
    ///
    /// # Returns
    /// A tuple `(total_waste_count, total_active_weight_grams, total_tokens_earned)`.
    ///
    /// > **Note:** `total_active_weight_grams` iterates all v2 waste records and
    /// > may be expensive for large datasets.
    pub fn get_supply_chain_stats(env: Env) -> (u64, u64, u128) {
        let total_wastes = Self::get_waste_count(&env);
        let total_weight = Self::get_total_active_waste_weight(&env);
        let total_tokens = Self::get_total_tokens(&env);

        (total_wastes, total_weight, total_tokens)
    }

    /// Get all incentives created by a specific rewarder/manufacturer
    /// Returns full Incentive structs for all incentives created by the rewarder
    /// Returns empty vector if rewarder has no incentives
    pub fn get_incentives_by_rewarder(env: Env, rewarder: Address) -> Vec<Incentive> {
        let key = ("rewarder_incentives", rewarder);
        let incentive_ids: Vec<u64> = env.storage().instance().get(&key).unwrap_or(Vec::new(&env));
        
        let mut incentives = Vec::new(&env);
        for incentive_id in incentive_ids.iter() {
            if let Some(incentive) = Self::get_incentive_internal(&env, incentive_id) {
                incentives.push_back(incentive);
            }
        }
        
        incentives
    }

    /// Get the best (highest reward) active incentive for a manufacturer and waste type.
    ///
    /// # Parameters
    /// - `manufacturer`: Address of the manufacturer whose incentives to search.
    /// - `waste_type`: The [`WasteType`] to match.
    ///
    /// # Returns
    /// `Some(Incentive)` with the highest `reward_points`, or `None` if no
    /// active matching incentive exists.
    pub fn get_active_mfr_incentive(
        env: Env,
        manufacturer: Address,
        waste_type: WasteType,
    ) -> Option<Incentive> {
        // Get all incentives for this manufacturer
        let key = ("rewarder_incentives", manufacturer.clone());
        let incentive_ids: Vec<u64> = env.storage().instance().get(&key).unwrap_or(Vec::new(&env));
        
        let mut best_incentive: Option<Incentive> = None;
        let mut highest_reward: u64 = 0;

        // Iterate through all incentives and find the best active one
        for incentive_id in incentive_ids.iter() {
            if let Some(incentive) = Self::get_incentive_internal(&env, incentive_id) {
                // Check if incentive matches criteria: active and correct waste type
                if incentive.active && incentive.waste_type == waste_type {
                    // Keep track of the incentive with highest reward
                    if incentive.reward_points > highest_reward {
                        highest_reward = incentive.reward_points;
                        best_incentive = Some(incentive);
                    }
                }
            }
        }

        best_incentive
    }

    /// Create a new manufacturer incentive program for a specific waste type.
    ///
    /// Only registered `Manufacturer` participants may create incentives.
    /// The incentive is indexed both by rewarder and by waste type for efficient lookup.
    ///
    /// # Parameters
    /// - `rewarder`: Manufacturer creating the incentive. Must sign.
    /// - `waste_type`: The [`WasteType`] this incentive applies to.
    /// - `reward_points`: Tokens awarded per kg of qualifying waste.
    /// - `total_budget`: Maximum total tokens this incentive can distribute.
    ///
    /// # Returns
    /// The newly created [`Incentive`] with `active = true`.
    ///
    /// # Errors
    /// - Panics `"Caller is not a manufacturer"`.
    ///
    /// # Example
    /// ```text
    /// create_incentive(manufacturer, WasteType::Plastic, 50, 10_000)
    /// // 50 tokens per kg, up to 10 000 tokens total
    /// ```
    pub fn create_incentive(
        env: Env,
        rewarder: Address,
        waste_type: WasteType,
        reward_points: u64,
        total_budget: u64,
    ) -> Incentive {
        // Access control check
        Self::require_not_paused(&env);
        Self::only_manufacturer(&env, &rewarder);

        // Get next incentive ID
        let incentive_id = Self::next_incentive_id(&env);

        // Create incentive
        let incentive = Incentive::new(
            incentive_id,
            rewarder.clone(),
            waste_type,
            reward_points,
            total_budget,
            env.ledger().timestamp(),
        );

        // Store incentive
        Self::set_incentive(&env, incentive_id, &incentive);

        // Add to rewarder's incentive list
        let key = ("rewarder_incentives", rewarder.clone());
        let mut rewarder_incentives: Vec<u64> =
            env.storage().instance().get(&key).unwrap_or(Vec::new(&env));
        rewarder_incentives.push_back(incentive_id);
        env.storage().instance().set(&key, &rewarder_incentives);

        // Add to general incentives list for this waste type
        let key = ("general_incentives", waste_type);
        let mut general_incentives: Vec<u64> =
            env.storage().instance().get(&key).unwrap_or(Vec::new(&env));
        general_incentives.push_back(incentive_id);
        env.storage().instance().set(&key, &general_incentives);

        incentive
    }

    /// Claim reward tokens from an incentive for a verified material.
    ///
    /// Deducts the reward from `incentive.remaining_budget` and credits it to
    /// `claimer.total_tokens_earned`. Automatically deactivates the incentive
    /// if the budget reaches zero.
    ///
    /// # Parameters
    /// - `incentive_id`: ID of the incentive to claim from.
    /// - `material_id`: ID of the verified v1 material being claimed for.
    /// - `claimer`: Registered participant claiming the reward. Must sign.
    ///
    /// # Returns
    /// The reward amount as `i128`.
    ///
    /// # Errors
    /// - Panics `"Incentive not found"` / `"Incentive is not active"`.
    /// - Panics `"Material not found"` / `"Material not verified"`.
    /// - Panics `"Waste type mismatch"`.
    /// - Panics `"No reward available"` if calculated reward is zero.
    pub fn claim_incentive_reward(
        env: Env,
        incentive_id: u64,
        material_id: u64,
        claimer: Address,
    ) -> i128 {
        Self::require_not_paused(&env);
        Self::only_registered(&env, &claimer);

        let mut incentive =
            Self::get_incentive_internal(&env, incentive_id).expect("Incentive not found");
        if !incentive.active {
            panic!("Incentive is not active");
        }

        let material = Self::get_waste_internal(&env, material_id).expect("Material not found");
        if !material.verified {
            panic!("Material not verified");
        }
        if material.waste_type != incentive.waste_type {
            panic!("Waste type mismatch");
        }

        let reward = Self::calculate_incentive_reward(env.clone(), incentive_id, material.weight);
        if reward == 0 {
            panic!("No reward available");
        }

        incentive.remaining_budget = incentive.remaining_budget.saturating_sub(reward);
        if incentive.remaining_budget == 0 {
            incentive.active = false;
        }
        Self::set_incentive(&env, incentive_id, &incentive);

        Self::update_participant_stats(&env, &claimer, 0, reward);

        reward as i128
    }

    /// Deactivate an incentive permanently.
    ///
    /// Only the original creator (`rewarder`) may deactivate their incentive.
    ///
    /// # Parameters
    /// - `incentive_id`: ID of the incentive to deactivate.
    /// - `rewarder`: Original creator. Must sign and be registered.
    ///
    /// # Returns
    /// The updated [`Incentive`] with `active = false`.
    ///
    /// # Errors
    /// - Panics `"Incentive not found"`.
    /// - Panics `"Only incentive creator can deactivate"`.
    pub fn deactivate_incentive(env: Env, incentive_id: u64, rewarder: Address) -> Incentive {
        Self::require_not_paused(&env);
        rewarder.require_auth();
        Self::require_registered(&env, &rewarder);

        let mut incentive =
            Self::get_incentive_internal(&env, incentive_id).expect("Incentive not found");

        // Verify caller is the creator
        if incentive.rewarder != rewarder {
            panic!("Only incentive creator can deactivate");
        }

        incentive.deactivate();
        Self::set_incentive(&env, incentive_id, &incentive);

        incentive
    }

    // ========== Global Metrics ==========

    /// Get global contract metrics (total waste count and total tokens earned)
    pub fn get_metrics(env: Env) -> types::GlobalMetrics {
        let total_wastes_count: u64 = env
            .storage()
            .instance()
            .get(&symbol_short!("MAT_CNT"))
            .unwrap_or(0);
        let total_tokens_earned: u128 = env
            .storage()
            .instance()
            .get(&TOTAL_TOKENS)
            .unwrap_or(0);
        types::GlobalMetrics {
            total_wastes_count,
            total_tokens_earned,
        }
    }

    // ========== Admin Transfer ==========

    /// Pause the contract (admin only) — blocks all state-changing functions
    pub fn pause(env: Env, admin: Address) {
        Self::require_admin(&env, &admin);
        assert!(!env.storage().instance().get::<_, bool>(&PAUSED).unwrap_or(false), "Contract is already paused");
        env.storage().instance().set(&PAUSED, &true);
        events::emit_contract_paused(&env, &admin);
    }

    /// Unpause the contract (admin only)
    pub fn unpause(env: Env, admin: Address) {
        Self::require_admin(&env, &admin);
        assert!(env.storage().instance().get::<_, bool>(&PAUSED).unwrap_or(false), "Contract is not paused");
        env.storage().instance().set(&PAUSED, &false);
        events::emit_contract_unpaused(&env, &admin);
    }

    /// Get current pause state
    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get::<_, bool>(&PAUSED).unwrap_or(false)
    }

    fn require_not_paused(env: &Env) {
        assert!(!env.storage().instance().get::<_, bool>(&PAUSED).unwrap_or(false), "Contract is paused");
    }

    // ========== Incentive-Based Reward Distribution ==========

    /// Distribute rewards through the supply chain for a confirmed material using an incentive.
    /// Rewards collectors in the transfer history, the original submitter, and the current owner.
    /// Returns the total reward distributed.
    pub fn distribute_rewards(
        env: Env,
        waste_id: u64,
        incentive_id: u64,
        manufacturer: Address,
    ) -> i128 {
        manufacturer.require_auth();

        let material = Self::get_waste_internal(&env, waste_id).expect("Material not found");
        assert!(material.verified, "Material must be confirmed");

        Self::require_not_paused(&env);
        let mut incentive =
            Self::get_incentive_internal(&env, incentive_id).expect("Incentive not found");
        assert!(incentive.rewarder == manufacturer, "Only incentive creator can distribute rewards");
        assert!(incentive.waste_type == material.waste_type, "Waste type mismatch");
        assert!(incentive.active, "Incentive not active");

        let weight_kg = material.weight / 1000;
        let total_reward = (incentive.reward_points as i128) * (weight_kg as i128);
        assert!(
            (total_reward as u64) <= incentive.remaining_budget,
            "Insufficient incentive budget"
        );

        let transfers = Self::get_transfer_history(env.clone(), waste_id);
        let cfg = Self::get_reward_config(&env);
        let collector_pct: u32 = cfg.collector_percentage;
        let owner_pct: u32 = cfg.owner_percentage;
        let collector_pct = cfg.collector_percentage;
        let owner_pct = cfg.owner_percentage;

        let token_address: Address = env
            .storage()
            .instance()
            .get(&TOKEN_ADDR)
            .expect("Token address not set");
        let token_client = token::Client::new(&env, &token_address);

        let collector_share = (total_reward * (collector_pct as i128)) / 100;
        let owner_share = (total_reward * (owner_pct as i128)) / 100;
        let mut total_distributed: i128 = 0;

        for transfer in transfers.iter() {
            let key = (transfer.to.clone(),);
            if let Some(p) = env.storage().instance().get::<_, Participant>(&key) {
                if p.role.can_collect_materials() && !p.role.can_manufacture() {
                    token_client.transfer(&manufacturer, &transfer.to, &collector_share);
                    Self::update_participant_stats(&env, &transfer.to, 0, collector_share as u64);
                    events::emit_tokens_rewarded(&env, &transfer.to, collector_share as u128, waste_id);
                    total_distributed += collector_share;
                }
            }
        }

        token_client.transfer(&manufacturer, &material.submitter, &owner_share);
        Self::update_participant_stats(&env, &material.submitter, 0, owner_share as u64);
        events::emit_tokens_rewarded(&env, &material.submitter, owner_share as u128, waste_id);
        total_distributed += owner_share;

        let recycler_amount = total_reward - total_distributed;
        if recycler_amount > 0 {
            token_client.transfer(&manufacturer, &material.submitter, &recycler_amount);
            Self::update_participant_stats(&env, &material.submitter, 0, recycler_amount as u64);
            events::emit_tokens_rewarded(&env, &material.submitter, recycler_amount as u128, waste_id);
        }

        incentive.remaining_budget = incentive.remaining_budget.saturating_sub(total_reward as u64);
        if incentive.remaining_budget == 0 {
            incentive.active = false;
        }
        Self::set_incentive(&env, incentive_id, &incentive);
        Self::add_to_total_tokens(&env, total_reward as u128);

        total_reward
    }
}
