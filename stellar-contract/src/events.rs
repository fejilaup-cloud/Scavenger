use soroban_sdk::{symbol_short, Address, Env, Symbol};

use crate::types::{ParticipantRole, WasteType};

const WASTE_REGISTERED: Symbol = symbol_short!("recycled");
const DONATION_MADE: Symbol = symbol_short!("donated");
const WASTE_TRANSFERRED: Symbol = symbol_short!("transfer");
const WASTE_CONFIRMED: Symbol = symbol_short!("confirmed");
const PARTICIPANT_REGISTERED: Symbol = symbol_short!("reg");
const TOKENS_REWARDED: Symbol = symbol_short!("rewarded");

/// Emit event when waste is registered
pub fn emit_waste_registered(
    env: &Env,
    waste_id: u128,
    recycler: &Address,
    waste_type: WasteType,
    weight: u128,
    latitude: i128,
    longitude: i128,
) {
    env.events().publish(
        (WASTE_REGISTERED, waste_id),
        (waste_type, weight, recycler, latitude, longitude),
    );
}

/// Emit event when a donation is made to charity
pub fn emit_donation_made(
    env: &Env,
    donor: &Address,
    amount: i128,
    charity_contract: &Address,
) {
    env.events().publish(
        (DONATION_MADE, donor),
        (amount, charity_contract),
    );
}

/// Emit event when waste is transferred
pub fn emit_waste_transferred(
    env: &Env,
    waste_id: u64,
    from: &Address,
    to: &Address,
) {
    env.events().publish(
        (WASTE_TRANSFERRED, waste_id),
        (from, to),
    );
}

/// Emit event when waste is confirmed by a third party
pub fn emit_waste_confirmed(
    env: &Env,
    waste_id: u128,
    confirmer: &Address,
) {
    env.events().publish(
        (WASTE_CONFIRMED, waste_id),
        confirmer,
    );
}

/// Emit event when a participant registers
pub fn emit_participant_registered(
    env: &Env,
    address: &Address,
    role: ParticipantRole,
    name: Symbol,
    latitude: i128,
    longitude: i128,
) {
    env.events().publish(
        (PARTICIPANT_REGISTERED, address),
        (role.to_u32(), name, latitude, longitude),
    );
}

/// Emit event when tokens are rewarded
pub fn emit_tokens_rewarded(
    env: &Env,
    recipient: &Address,
    amount: u128,
    waste_id: u64,
) {
    env.events().publish(
        (TOKENS_REWARDED, recipient),
        (amount, waste_id),
    );
}

/// Emit event when a participant updates their location
pub fn emit_participant_location_updated(
    env: &Env,
    address: &Address,
    latitude: i128,
    longitude: i128,
) {
    env.events().publish(
        (symbol_short!("loc_upd"), address),
        (latitude, longitude),
    );
}

pub fn emit_admin_transferred(env: &Env, previous_admin: &Address) {
    env.events().publish((symbol_short!("adm_xfr"),), previous_admin);
}

pub fn emit_waste_expired(env: &Env, waste_id: u128) {
    env.events().publish(
        (symbol_short!("expired"), waste_id),
        env.ledger().timestamp(),
    );
}

pub fn emit_waste_deactivated(env: &Env, waste_id: u128, admin: &Address) {
    env.events().publish(
        (symbol_short!("deactive"), waste_id),
        (admin, env.ledger().timestamp()),
    );
}

pub fn emit_contract_paused(env: &Env, admin: &Address) {
    env.events().publish((symbol_short!("paused"),), admin);
}

pub fn emit_contract_unpaused(env: &Env, admin: &Address) {
    env.events().publish((symbol_short!("unpaused"),), admin);
}

/// Emit event when an incentive schedule is set
pub fn emit_incentive_scheduled(
    env: &Env,
    incentive_id: u64,
    rewarder: &Address,
    starts_at: Option<u64>,
    ends_at: Option<u64>,
) {
    env.events().publish(
        (symbol_short!("inc_sched"), incentive_id),
        (rewarder, starts_at, ends_at),
    );
}

/// Emit event when a waste item is reserved
pub fn emit_waste_reserved(env: &Env, waste_id: u128, reserved_by: &Address, reserved_until: u64) {
    env.events().publish(
        (symbol_short!("wst_res"), waste_id),
        (reserved_by, reserved_until),
    );
}

/// Emit event when a reservation is cancelled
pub fn emit_reservation_cancelled(env: &Env, waste_id: u128, cancelled_by: &Address) {
    env.events().publish(
        (symbol_short!("res_cncl"), waste_id),
        cancelled_by,
    );
}

/// Emit event when multiple waste items are merged into one
pub fn emit_wastes_merged(
    env: &Env,
    merged_id: u128,
    owner: &Address,
    source_ids: &soroban_sdk::Vec<u128>,
) {
    env.events().publish(
        (symbol_short!("wst_mrgd"), merged_id),
        (owner, source_ids),
    );
}

/// Emit event when a waste item is split into multiple child items
pub fn emit_waste_split(
    env: &Env,
    parent_id: u128,
    owner: &Address,
    child_ids: &soroban_sdk::Vec<u128>,
) {
    env.events().publish(
        (symbol_short!("waste_spl"), parent_id),
        (owner, child_ids),
    );
}
