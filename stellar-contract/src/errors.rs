use soroban_sdk::contracterror;

/// Typed error codes for the Scavngr contract.
///
/// Every public function that can fail returns `Result<T, Error>`.
/// Frontend clients should map the numeric `u32` code (shown in parentheses)
/// to a user-facing message.
///
/// | Code | Variant | Meaning |
/// |------|---------|---------|
/// | 1 | `AlreadyInitialized` | Admin already set |
/// | 2 | `Unauthorized` | Caller is not the admin |
/// | 3 | `NotRegistered` | Address is not a registered participant |
/// | 4 | `AlreadyRegistered` | Address is already registered |
/// | 5 | `NotManufacturer` | Caller's role is not Manufacturer |
/// | 6 | `NotWasteOwner` | Caller does not own the waste item |
/// | 7 | `WasteNotFound` | No waste record exists for the given ID |
/// | 8 | `MaterialNotFound` | No material record exists for the given ID |
/// | 9 | `IncentiveNotFound` | No incentive record exists for the given ID |
/// | 10 | `ParticipantNotFound` | No participant record exists for the given address |
/// | 11 | `InvalidAmount` | Amount is zero or negative |
/// | 12 | `InvalidWeight` | Weight is zero |
/// | 13 | `InvalidCoordinates` | Latitude or longitude is out of range |
/// | 14 | `InvalidPercentage` | Percentages sum exceeds 100 |
/// | 15 | `InsufficientBalance` | Donor's token balance is too low |
/// | 16 | `CharityNotSet` | Charity contract address has not been configured |
/// | 17 | `TokenAddressNotSet` | Token contract address has not been configured |
/// | 18 | `WasteDeactivated` | Operation rejected because the waste is deactivated |
/// | 19 | `WasteAlreadyDeactivated` | Waste is already in the deactivated state |
/// | 20 | `WasteAlreadyConfirmed` | Waste has already been confirmed |
/// | 21 | `WasteNotConfirmed` | Waste has not been confirmed yet |
/// | 22 | `SelfConfirmation` | Owner cannot confirm their own waste |
/// | 23 | `IncentiveInactive` | Incentive is not active |
/// | 24 | `MaterialNotVerified` | Material must be verified before claiming |
/// | 25 | `WasteTypeMismatch` | Material waste type does not match incentive |
/// | 26 | `NoRewardAvailable` | Calculated reward is zero (budget exhausted or weight too low) |
/// | 27 | `InvalidTransferRoute` | Role combination is not a permitted transfer route |
/// | 28 | `SameAddress` | Two addresses that must differ are equal |
/// | 29 | `Overflow` | Arithmetic overflow detected |
/// | 30 | `NotCreator` | Caller is not the original creator of the resource |
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    /// (1) The contract admin has already been initialised.
    /// Returned by: `initialize_admin`
    AlreadyInitialized = 1,

    /// (2) The caller is not the contract administrator.
    /// Returned by: any admin-only function
    Unauthorized = 2,

    /// (3) The address is not a registered participant, or `is_registered` is false.
    /// Returned by: any function that requires a registered caller or target
    NotRegistered = 3,

    /// (4) The address is already registered as a participant.
    /// Returned by: `register_participant`
    AlreadyRegistered = 4,

    /// (5) The caller's role is not `Manufacturer`.
    /// Returned by: `create_incentive`
    NotManufacturer = 5,

    /// (6) The caller does not own the specified waste item.
    /// Returned by: `transfer_waste_v2`, `reset_waste_confirmation`, `deactivate_waste`
    NotWasteOwner = 6,

    /// (7) No waste record exists for the given ID (v2 storage).
    /// Returned by: `transfer_waste_v2`, `confirm_waste_details`, `reset_waste_confirmation`,
    ///              `deactivate_waste`
    WasteNotFound = 7,

    /// (8) No material record exists for the given ID (v1 storage).
    /// Returned by: `verify_material`, `transfer_waste`, `claim_incentive_reward`
    MaterialNotFound = 8,

    /// (9) No incentive record exists for the given ID.
    /// Returned by: `update_incentive`, `update_incentive_status`, `calculate_incentive_reward`,
    ///              `claim_incentive_reward`, `deactivate_incentive`
    IncentiveNotFound = 9,

    /// (10) No participant record exists for the given address.
    /// Returned by: `update_role`, `deregister_participant`, `update_location`,
    ///              `verify_material`, `donate_to_charity`
    ParticipantNotFound = 10,

    /// (11) A monetary or token amount is zero or negative.
    /// Returned by: `donate_to_charity`, `reward_tokens`
    InvalidAmount = 11,

    /// (12) A waste weight value is zero.
    /// Returned by: `recycle_waste`
    InvalidWeight = 12,

    /// (13) Latitude is outside [-90°, +90°] or longitude outside [-180°, +180°]
    /// (values in microdegrees, e.g. ±90_000_000).
    /// Returned by: `register_participant`
    InvalidCoordinates = 13,

    /// (14) `collector_percentage + owner_percentage` exceeds 100.
    /// Returned by: `set_percentages`, `set_collector_percentage`, `set_owner_percentage`
    InvalidPercentage = 14,

    /// (15) The donor's `total_tokens_earned` is less than the requested donation amount.
    /// Returned by: `donate_to_charity`
    InsufficientBalance = 15,

    /// (16) No charity contract address has been set via `set_charity_contract`.
    /// Returned by: `donate_to_charity`
    CharityNotSet = 16,

    /// (17) No token contract address has been set via `set_token_address`.
    /// Returned by: `reward_tokens`
    TokenAddressNotSet = 17,

    /// (18) The waste item is deactivated and cannot be transferred or confirmed.
    /// Returned by: `transfer_waste_v2`, `confirm_waste_details`
    WasteDeactivated = 18,

    /// (19) The waste item is already in the deactivated state.
    /// Returned by: `deactivate_waste`
    WasteAlreadyDeactivated = 19,

    /// (20) The waste item has already been confirmed by another participant.
    /// Returned by: `confirm_waste_details`
    WasteAlreadyConfirmed = 20,

    /// (21) The waste item has not been confirmed yet.
    /// Returned by: `reset_waste_confirmation`
    WasteNotConfirmed = 21,

    /// (22) The current owner attempted to confirm their own waste item.
    /// Returned by: `confirm_waste_details`
    SelfConfirmation = 22,

    /// (23) The incentive is not active and cannot be used.
    /// Returned by: `update_incentive`, `claim_incentive_reward`
    IncentiveInactive = 23,

    /// (24) The material has not been verified and cannot be used for reward claims.
    /// Returned by: `claim_incentive_reward`
    MaterialNotVerified = 24,

    /// (25) The material's waste type does not match the incentive's waste type.
    /// Returned by: `claim_incentive_reward`
    WasteTypeMismatch = 25,

    /// (26) The calculated reward is zero — either the budget is exhausted or
    /// the waste weight is below 1 kg.
    /// Returned by: `claim_incentive_reward`
    NoRewardAvailable = 26,

    /// (27) The role combination (`from` → `to`) is not a permitted transfer route.
    /// Valid routes: Recycler→Collector, Recycler→Manufacturer, Collector→Manufacturer.
    /// Returned by: `transfer_waste_v2`
    InvalidTransferRoute = 27,

    /// (28) Two addresses that must be different are equal
    /// (e.g. charity address equals admin address).
    /// Returned by: `set_charity_contract`
    SameAddress = 28,

    /// (29) An arithmetic operation would overflow.
    /// Returned by: any function performing checked arithmetic
    Overflow = 29,

    /// (30) The caller is not the original creator of the resource.
    /// Returned by: `deactivate_incentive`
    NotCreator = 30,

    /// (31) Insufficient budget for the reward.
    InsufficientBudget = 31,

    /// (32) The number of splits exceeds the maximum allowed (10).
    TooManySplits = 32,

    /// (33) The sum of split weights does not equal the original waste weight.
    WeightMismatch = 33,

    /// (34) At least two split weights are required.
    TooFewSplits = 34,

    /// (35) Fewer than 2 waste IDs provided for merge.
    TooFewWastes = 35,

    /// (36) More than 20 waste IDs provided for merge.
    TooManyWastes = 36,

    /// (37) Not all wastes share the same WasteType.
    WasteTypeMismatchMerge = 37,

    /// (38) Not all wastes share the same location.
    LocationMismatch = 38,

    /// (39) Waste is already reserved by another participant.
    WasteAlreadyReserved = 39,

    /// (40) Waste is not reserved (cannot cancel a non-existent reservation).
    WasteNotReserved = 40,

    /// (41) Caller is not the reserver and not the owner; cannot cancel.
    NotReserver = 41,

    /// (42) Waste is reserved by someone else; transfer is blocked.
    WasteReservedByOther = 42,

    /// (43) starts_at is not before ends_at, or both are in the past.
    InvalidSchedule = 43,
    /// (32) The waste item has expired (TTL elapsed).
    /// Returned by: `transfer_waste_v2`, `batch_transfer_waste`
    WasteExpired = 32,
}
