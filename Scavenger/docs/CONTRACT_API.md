# Scavenger Contract API Reference

This document is the authoritative API reference for `ScavengerContract`, the Soroban/Stellar smart contract powering the Scavenger recycling ecosystem. It is intended for external integrators — frontend developers, tooling authors, and third-party dApps — who need accurate documentation of every public contract function, its parameters, return types, error codes, emitted events, and usage examples, without needing to read the Rust source.

The contract source lives in `stellar-contract/src/` and is written in Rust using the Soroban SDK. All types, errors, and events referenced throughout this document are defined in the sections below.

## Table of Contents

- [Types](#types)
  - [RewardConfig](#rewardconfig)
  - [Participant](#participant)
  - [ParticipantInfo](#participantinfo)
  - [Material](#material)
  - [Waste](#waste)
  - [WasteTransfer](#wastetransfer)
  - [Incentive](#incentive)
  - [RecyclingStats](#recyclingstats)
  - [GlobalMetrics](#globalmetrics)
  - [WasteType](#wastetype)
  - [ParticipantRole](#participantrole)
- [Errors](#errors)
- [Events](#events)
  - [recycled](#recycled)
  - [donated](#donated)
  - [transfer](#transfer)
  - [confirmed](#confirmed)
  - [reg](#reg)
  - [rewarded](#rewarded)
  - [loc_upd](#loc_upd)
  - [adm_xfr](#adm_xfr)
  - [paused](#paused)
  - [unpaused](#unpaused)
  - [bulk_xfr](#bulk_xfr)
  - [reset](#reset)
  - [deactive](#deactive)
  - [inc_upd](#inc_upd)
- [Supply-Chain Transfer Rules](#supply-chain-transfer-rules)
- [Reward Distribution](#reward-distribution)
- [Admin](#admin)
  - [initialize_admin](#initialize_admin)
  - [get_admin](#get_admin)
  - [get_admins](#get_admins)
  - [transfer_admin](#transfer_admin)
  - [add_admin](#add_admin)
  - [remove_admin](#remove_admin)
  - [set_charity_contract](#set_charity_contract)
  - [get_charity_contract](#get_charity_contract)
  - [donate_to_charity](#donate_to_charity)
- [Participant Management](#participant-management)
  - [register_participant](#register_participant)
  - [is_participant_registered](#is_participant_registered)
  - [get_participant](#get_participant)
  - [get_participant_info](#get_participant_info)
  - [get_participant_earnings](#get_participant_earnings)
  - [get_all_participants](#get_all_participants)
  - [update_role](#update_role)
  - [deregister_participant](#deregister_participant)
  - [update_participant_location](#update_participant_location)
  - [update_location](#update_location) _(deprecated)_
- [Waste (v1)](#waste-v1)
  - [submit_material](#submit_material)
  - [submit_materials_batch](#submit_materials_batch)
  - [verify_material](#verify_material)
  - [verify_materials_batch](#verify_materials_batch)
  - [get_material](#get_material)
  - [get_waste](#get_waste)
  - [get_waste_by_id](#get_waste_by_id) _(deprecated)_
  - [get_wastes_batch](#get_wastes_batch)
  - [get_participant_wastes](#get_participant_wastes)
  - [waste_exists](#waste_exists)
  - [get_waste_type_string](#get_waste_type_string)
  - [get_participant_role_string](#get_participant_role_string)
  - [transfer_waste](#transfer_waste) _(deprecated)_
  - [get_transfer_history](#get_transfer_history)
  - [get_waste_transfer_history](#get_waste_transfer_history)
  - [get_transfers_from](#get_transfers_from)
  - [get_transfers_to](#get_transfers_to)
  - [can_collect](#can_collect)
  - [can_manufacture](#can_manufacture)
- [Waste (v2)](#waste-v2)
  - [recycle_waste](#recycle_waste)
  - [get_waste_v2](#get_waste_v2)
  - [get_participant_wastes_v2](#get_participant_wastes_v2)
  - [transfer_waste_v2](#transfer_waste_v2)
  - [batch_transfer_waste](#batch_transfer_waste)
  - [transfer_collected_waste](#transfer_collected_waste)
  - [confirm_waste_details](#confirm_waste_details)
  - [reset_waste_confirmation](#reset_waste_confirmation)
  - [deactivate_waste](#deactivate_waste)
  - [get_waste_transfer_history_v2](#get_waste_transfer_history_v2)
  - [is_valid_transfer](#is_valid_transfer)
- [Incentives](#incentives)
  - [create_incentive](#create_incentive)
  - [update_incentive](#update_incentive)
  - [update_incentive_status](#update_incentive_status)
  - [deactivate_incentive](#deactivate_incentive)
  - [get_incentive_by_id](#get_incentive_by_id)
  - [get_incentives](#get_incentives)
  - [get_incentives_by_waste_type](#get_incentives_by_waste_type)
  - [get_incentives_by_rewarder](#get_incentives_by_rewarder)
  - [get_active_incentives](#get_active_incentives)
  - [get_active_mfr_incentive](#get_active_mfr_incentive)
  - [incentive_exists](#incentive_exists)
  - [calculate_incentive_reward](#calculate_incentive_reward)
  - [claim_incentive_reward](#claim_incentive_reward)
- [Rewards & Tokens](#rewards-tokens)
  - [set_token_address](#set_token_address)
  - [get_token_address](#get_token_address)
  - [reward_tokens](#reward_tokens)
  - [set_percentages](#set_percentages)
  - [get_collector_percentage](#get_collector_percentage)
  - [get_owner_percentage](#get_owner_percentage)
  - [set_collector_percentage](#set_collector_percentage)
  - [set_owner_percentage](#set_owner_percentage)
  - [distribute_rewards](#distribute_rewards)
- [Statistics & Queries](#statistics-queries)
  - [get_stats](#get_stats)
  - [get_supply_chain_stats](#get_supply_chain_stats)
  - [get_metrics](#get_metrics)
- [Contract Control](#contract-control)
  - [pause](#pause)
  - [unpause](#unpause)
  - [is_paused](#is_paused)

---

## Types

This section defines all `#[contracttype]` structs and enums used by the contract. Function entries throughout this document reference these definitions.

---

### RewardConfig

Holds the reward distribution percentages used when tokens are distributed across the supply chain. The remainder after subtracting both percentages goes to the recycler/submitter.

| Field                  | Type  | Description                                                                     |
| ---------------------- | ----- | ------------------------------------------------------------------------------- |
| `collector_percentage` | `u32` | Share (0–100) of the total reward given to each collector in the transfer chain |
| `owner_percentage`     | `u32` | Share (0–100) of the total reward given to the current waste owner              |

> **Constraint:** `collector_percentage + owner_percentage` must not exceed 100. The remaining percentage goes to the recycler/submitter.
>
> **Defaults:** `collector_percentage = 5`, `owner_percentage = 50`

---

### Participant

On-chain record for a registered supply-chain participant.

| Field                   | Type              | Description                                                                                                          |
| ----------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| `address`               | `Address`         | Stellar address of the participant                                                                                   |
| `role`                  | `ParticipantRole` | Role in the supply chain: `Recycler`, `Collector`, or `Manufacturer`                                                 |
| `name`                  | `Symbol`          | Short display name (max 32 chars)                                                                                    |
| `latitude`              | `i128`            | Registration location latitude in microdegrees (e.g. `52_520_000` = 52.52°). Valid range: −90 000 000 to +90 000 000 |
| `longitude`             | `i128`            | Registration location longitude in microdegrees. Valid range: −180 000 000 to +180 000 000                           |
| `is_registered`         | `bool`            | Whether the participant is currently active/registered                                                               |
| `total_waste_processed` | `u128`            | Cumulative grams of waste processed by this participant                                                              |
| `total_tokens_earned`   | `u128`            | Cumulative reward tokens earned by this participant                                                                  |
| `registered_at`         | `u64`             | Ledger timestamp at the time of registration                                                                         |

---

### ParticipantInfo

Combined view of a participant record and their recycling statistics. Returned by `get_participant_info`.

| Field         | Type             | Description                                                                       |
| ------------- | ---------------- | --------------------------------------------------------------------------------- |
| `participant` | `Participant`    | Full participant record (see [Participant](#participant))                         |
| `stats`       | `RecyclingStats` | Recycling statistics for this participant (see [RecyclingStats](#recyclingstats)) |

---

### Material

v1 waste submission record. Tracks a single recyclable material item submitted by a participant.

| Field          | Type        | Description                                                      |
| -------------- | ----------- | ---------------------------------------------------------------- |
| `id`           | `u64`       | Unique identifier for the material                               |
| `waste_type`   | `WasteType` | Category of waste (see [WasteType](#wastetype))                  |
| `weight`       | `u64`       | Weight of the material in grams. Must be > 0 and ≤ 1 000 000 000 |
| `submitter`    | `Address`   | Stellar address of the participant who submitted the material    |
| `submitted_at` | `u64`       | Ledger timestamp when the material was submitted                 |
| `verified`     | `bool`      | Whether the material has been verified by a Recycler             |
| `description`  | `String`    | Free-text description of the material                            |

---

### Waste

v2 waste record with GPS coordinates and u128 IDs. Tracks a waste item throughout its full lifecycle in the supply chain.

| Field                | Type        | Description                                                                              |
| -------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `waste_id`           | `u128`      | Unique identifier for the waste item                                                     |
| `waste_type`         | `WasteType` | Category of waste (see [WasteType](#wastetype))                                          |
| `weight`             | `u128`      | Weight of the waste in grams. Must be > 0 and ≤ 1 000 000 000                            |
| `current_owner`      | `Address`   | Stellar address of the current owner                                                     |
| `latitude`           | `i128`      | Collection location latitude in microdegrees. Valid range: −90 000 000 to +90 000 000    |
| `longitude`          | `i128`      | Collection location longitude in microdegrees. Valid range: −180 000 000 to +180 000 000 |
| `recycled_timestamp` | `u64`       | Ledger timestamp when the waste was recycled; `0` if not yet recycled                    |
| `is_active`          | `bool`      | Whether the waste record is currently active in the system                               |
| `is_confirmed`       | `bool`      | Whether the waste has been confirmed/verified by a third party                           |
| `confirmer`          | `Address`   | Stellar address of the participant who confirmed the waste                               |

---

### WasteTransfer

Record of a single ownership transfer in the supply chain. Created each time a waste item changes hands via `transfer_waste_v2` or `batch_transfer_waste`.

| Field            | Type      | Description                                                                            |
| ---------------- | --------- | -------------------------------------------------------------------------------------- |
| `waste_id`       | `u128`    | ID of the waste item that was transferred                                              |
| `from`           | `Address` | Stellar address of the sender                                                          |
| `to`             | `Address` | Stellar address of the recipient                                                       |
| `transferred_at` | `u64`     | Ledger timestamp when the transfer occurred                                            |
| `latitude`       | `i128`    | Transfer location latitude in microdegrees. Valid range: −90 000 000 to +90 000 000    |
| `longitude`      | `i128`    | Transfer location longitude in microdegrees. Valid range: −180 000 000 to +180 000 000 |
| `note`           | `Symbol`  | Short note or label attached to the transfer                                           |

---

### Incentive

Manufacturer-created reward program that offers tokens for recycling a specific waste type.

| Field              | Type        | Description                                                            |
| ------------------ | ----------- | ---------------------------------------------------------------------- |
| `id`               | `u64`       | Unique identifier for the incentive                                    |
| `rewarder`         | `Address`   | Stellar address of the Manufacturer who created the incentive          |
| `waste_type`       | `WasteType` | Target waste type this incentive rewards (see [WasteType](#wastetype)) |
| `reward_points`    | `u64`       | Tokens awarded per kilogram of qualifying waste                        |
| `total_budget`     | `u64`       | Total token budget allocated for this incentive                        |
| `remaining_budget` | `u64`       | Remaining token budget available for claims                            |
| `active`           | `bool`      | Whether the incentive is currently active and claimable                |
| `created_at`       | `u64`       | Ledger timestamp when the incentive was created                        |

---

### RecyclingStats

Per-participant recycling statistics. Tracks submission counts, weights, and reward points broken down by waste type.

| Field                  | Type      | Description                                              |
| ---------------------- | --------- | -------------------------------------------------------- |
| `participant`          | `Address` | Stellar address of the participant these stats belong to |
| `total_submissions`    | `u64`     | Total number of materials submitted                      |
| `verified_submissions` | `u64`     | Total number of verified (approved) material submissions |
| `total_weight`         | `u64`     | Total weight of all submitted materials in grams         |
| `total_points`         | `u64`     | Total reward points earned from verified submissions     |
| `paper_count`          | `u64`     | Number of Paper waste submissions                        |
| `pet_plastic_count`    | `u64`     | Number of PET plastic waste submissions                  |
| `plastic_count`        | `u64`     | Number of general plastic waste submissions              |
| `metal_count`          | `u64`     | Number of metal waste submissions                        |
| `glass_count`          | `u64`     | Number of glass waste submissions                        |

---

### GlobalMetrics

Contract-wide aggregate counters. Returned by `get_metrics`.

| Field                 | Type   | Description                                      |
| --------------------- | ------ | ------------------------------------------------ |
| `total_wastes_count`  | `u64`  | Total number of waste items logged in the system |
| `total_tokens_earned` | `u128` | Total tokens earned across all participants      |

---

### WasteType

Enum representing the category of a waste material. Used in `Material`, `Waste`, and `Incentive`.

| Variant      | Value | Description                                             |
| ------------ | ----- | ------------------------------------------------------- |
| `Paper`      | `0`   | Newspapers, cardboard, office paper                     |
| `PetPlastic` | `1`   | PET bottles and containers (polyethylene terephthalate) |
| `Plastic`    | `2`   | General plastic waste (various types)                   |
| `Metal`      | `3`   | Aluminum, steel, copper, and other metals               |
| `Glass`      | `4`   | Bottles, jars, and glass containers                     |

---

### ParticipantRole

Enum representing the role of a participant in the recycling supply chain. Determines which operations a participant can perform and which transfer routes are valid.

| Variant        | Value | Description                                                                  |
| -------------- | ----- | ---------------------------------------------------------------------------- |
| `Recycler`     | `0`   | Collects and processes recyclable materials; can submit and verify materials |
| `Collector`    | `1`   | Gathers materials from various sources; intermediate supply-chain node       |
| `Manufacturer` | `2`   | Processes materials into new products; can create incentive programs         |

---

## Errors

Every public function that can fail in a distinguishable way returns `Result<T, Error>`. The numeric code is what the Soroban runtime surfaces to callers; map it to the variant name and description below to produce actionable error messages.

> **Note on panics:** Some functions panic with a string message rather than returning a typed `Error`. These are documented in the individual Function_Entry sections. Common panic messages include `"Caller is not the contract admin"`, `"Caller is not a registered participant"`, and `"Caller is not the owner of this waste item"`.

| Code | Variant                   | Triggering Functions                                                                                                                                                                                                                                                                                                     | Description                                                                                                                                                                                                                           |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `AlreadyInitialized`      | `initialize_admin`                                                                                                                                                                                                                                                                                                       | The contract admin has already been set. `initialize_admin` can only be called once after deployment.                                                                                                                                 |
| 2    | `Unauthorized`            | _(any admin-only function via `require_admin`)_                                                                                                                                                                                                                                                                          | The caller is not in the admin list. Returned when an admin-gated operation is attempted by a non-admin address.                                                                                                                      |
| 3    | `NotRegistered`           | `register_participant`, `transfer_waste_v2`, `batch_transfer_waste`, `recycle_waste`, `submit_material`, `submit_materials_batch`, `verify_material`, `verify_materials_batch`, `claim_incentive_reward`, `donate_to_charity`, `update_role`, `deregister_participant`, `update_participant_location`, `update_location` | The address is not a registered participant, or `is_registered` is `false`. Returned by any function that requires a registered caller or target.                                                                                     |
| 4    | `AlreadyRegistered`       | `register_participant`                                                                                                                                                                                                                                                                                                   | The address is already registered as a participant. Call `deregister_participant` first if re-registration is needed.                                                                                                                 |
| 5    | `NotManufacturer`         | `create_incentive`                                                                                                                                                                                                                                                                                                       | The caller's role is not `Manufacturer`. Only `Manufacturer` participants may create incentive programs.                                                                                                                              |
| 6    | `NotWasteOwner`           | `transfer_waste_v2`, `reset_waste_confirmation`, `deactivate_waste`                                                                                                                                                                                                                                                      | The caller does not own the specified waste item. The `current_owner` field of the waste record must match the caller.                                                                                                                |
| 7    | `WasteNotFound`           | `transfer_waste_v2`, `confirm_waste_details`, `reset_waste_confirmation`, `deactivate_waste`, `batch_transfer_waste`                                                                                                                                                                                                     | No v2 waste record exists for the given ID. Verify the `waste_id` is correct and was created via `recycle_waste`.                                                                                                                     |
| 8    | `MaterialNotFound`        | `verify_material`, `transfer_waste`, `claim_incentive_reward`                                                                                                                                                                                                                                                            | No v1 material record exists for the given ID. Verify the `material_id` was created via `submit_material` or `submit_materials_batch`.                                                                                                |
| 9    | `IncentiveNotFound`       | `update_incentive`, `update_incentive_status`, `calculate_incentive_reward`, `claim_incentive_reward`, `deactivate_incentive`                                                                                                                                                                                            | No incentive record exists for the given ID. Verify the `incentive_id` was created via `create_incentive`.                                                                                                                            |
| 10   | `ParticipantNotFound`     | `update_role`, `deregister_participant`, `update_participant_location`, `update_location`, `verify_material`, `donate_to_charity`                                                                                                                                                                                        | No participant record exists for the given address. The address has never called `register_participant`.                                                                                                                              |
| 11   | `InvalidAmount`           | `donate_to_charity`, `reward_tokens`                                                                                                                                                                                                                                                                                     | A monetary or token amount is zero or negative. All `amount` parameters must be > 0.                                                                                                                                                  |
| 12   | `InvalidWeight`           | `recycle_waste`                                                                                                                                                                                                                                                                                                          | The waste weight value is zero. Weight must be > 0 and ≤ 1 000 000 000 grams.                                                                                                                                                         |
| 13   | `InvalidCoordinates`      | `register_participant`                                                                                                                                                                                                                                                                                                   | Latitude is outside [−90 000 000, +90 000 000] or longitude is outside [−180 000 000, +180 000 000] (values in microdegrees).                                                                                                         |
| 14   | `InvalidPercentage`       | `set_percentages`, `set_collector_percentage`, `set_owner_percentage`                                                                                                                                                                                                                                                    | `collector_percentage + owner_percentage` exceeds 100. The two percentages must sum to 100 or less.                                                                                                                                   |
| 15   | `InsufficientBalance`     | `donate_to_charity`                                                                                                                                                                                                                                                                                                      | The donor's `total_tokens_earned` is less than the requested donation amount.                                                                                                                                                         |
| 16   | `CharityNotSet`           | `donate_to_charity`                                                                                                                                                                                                                                                                                                      | No charity contract address has been configured. Call `set_charity_contract` before attempting a donation.                                                                                                                            |
| 17   | `TokenAddressNotSet`      | `reward_tokens`                                                                                                                                                                                                                                                                                                          | No token contract address has been configured. Call `set_token_address` before distributing rewards.                                                                                                                                  |
| 18   | `WasteDeactivated`        | `transfer_waste_v2`, `confirm_waste_details`, `batch_transfer_waste`                                                                                                                                                                                                                                                     | The waste item is deactivated and cannot be transferred or confirmed. Deactivation is irreversible.                                                                                                                                   |
| 19   | `WasteAlreadyDeactivated` | `deactivate_waste`                                                                                                                                                                                                                                                                                                       | The waste item is already in the deactivated state. No further action is needed.                                                                                                                                                      |
| 20   | `WasteAlreadyConfirmed`   | `confirm_waste_details`                                                                                                                                                                                                                                                                                                  | The waste item has already been confirmed by another participant. Call `reset_waste_confirmation` to clear the confirmation first.                                                                                                    |
| 21   | `WasteNotConfirmed`       | `reset_waste_confirmation`                                                                                                                                                                                                                                                                                               | The waste item has not been confirmed yet, so there is nothing to reset.                                                                                                                                                              |
| 22   | `SelfConfirmation`        | `confirm_waste_details`                                                                                                                                                                                                                                                                                                  | The current owner attempted to confirm their own waste item. A different registered participant must perform the confirmation.                                                                                                        |
| 23   | `IncentiveInactive`       | `update_incentive`, `claim_incentive_reward`                                                                                                                                                                                                                                                                             | The incentive is not active and cannot be updated or claimed. Call `update_incentive_status` to re-enable it.                                                                                                                         |
| 24   | `MaterialNotVerified`     | `claim_incentive_reward`                                                                                                                                                                                                                                                                                                 | The material has not been verified by a Recycler. Call `verify_material` before claiming a reward.                                                                                                                                    |
| 25   | `WasteTypeMismatch`       | `claim_incentive_reward`                                                                                                                                                                                                                                                                                                 | The material's waste type does not match the incentive's target waste type. Use an incentive that matches the material's `waste_type`.                                                                                                |
| 26   | `NoRewardAvailable`       | `claim_incentive_reward`                                                                                                                                                                                                                                                                                                 | The calculated reward is zero — either the incentive budget is exhausted or the waste weight is below 1 kg (1 000 g).                                                                                                                 |
| 27   | `InvalidTransferRoute`    | `transfer_waste_v2`, `batch_transfer_waste`                                                                                                                                                                                                                                                                              | The role combination (`from` → `to`) is not a permitted transfer route. Valid routes: `Recycler → Collector`, `Recycler → Manufacturer`, `Collector → Manufacturer`. See [Supply-Chain Transfer Rules](#supply-chain-transfer-rules). |
| 28   | `SameAddress`             | `set_charity_contract`, `batch_transfer_waste`                                                                                                                                                                                                                                                                           | Two addresses that must be different are equal (e.g. the charity address equals the admin address, or a self-transfer was attempted).                                                                                                 |
| 29   | `Overflow`                | _(any function performing checked arithmetic)_                                                                                                                                                                                                                                                                           | An arithmetic operation would overflow. This indicates an extremely large accumulated value and should not occur under normal usage.                                                                                                  |
| 30   | `NotCreator`              | `deactivate_incentive`                                                                                                                                                                                                                                                                                                   | The caller is not the original creator (`rewarder`) of the incentive. Only the manufacturer who created the incentive may deactivate it.                                                                                              |
| 31   | `InsufficientBudget`      | `claim_incentive_reward`                                                                                                                                                                                                                                                                                                 | The calculated reward exceeds the incentive's `remaining_budget`. The incentive does not have enough tokens left to fulfil the claim.                                                                                                 |

---

## Events

The contract publishes events to the Stellar network for every significant state change. Integrators can subscribe to these events using the Stellar Horizon API or the Soroban event streaming endpoint.

Each event has:

- A **topic tuple** — the indexed fields used for filtering (first element is always the symbol key).
- A **data payload** — the non-indexed fields carrying the event details.

> **Soroban event format:** Topics are XDR-encoded `ScVal` values. The symbol key is a `ScVal::Symbol`. Indexed addresses and IDs are `ScVal::Address` and `ScVal::U128`/`ScVal::U64` respectively.

---

### `recycled`

Emitted when a new v2 waste record is created via `recycle_waste`.

**Symbol key:** `recycled`

**Topic tuple**

| Position | Value      | Type   | Description                   |
| -------- | ---------- | ------ | ----------------------------- |
| 0        | `recycled` | Symbol | Event identifier              |
| 1        | `waste_id` | `u128` | ID of the newly created waste |

**Data payload**

| Field        | Type        | Description                                        |
| ------------ | ----------- | -------------------------------------------------- |
| `waste_type` | `WasteType` | Category of the waste (Paper, PetPlastic, etc.)    |
| `weight`     | `u128`      | Weight of the waste in grams                       |
| `recycler`   | `Address`   | Address of the participant who submitted the waste |
| `latitude`   | `i128`      | Collection latitude in microdegrees                |
| `longitude`  | `i128`      | Collection longitude in microdegrees               |

**Emitting functions**

- `recycle_waste`

---

### `donated`

Emitted when a participant donates tokens to the configured charity contract.

**Symbol key:** `donated`

**Topic tuple**

| Position | Value     | Type    | Description          |
| -------- | --------- | ------- | -------------------- |
| 0        | `donated` | Symbol  | Event identifier     |
| 1        | `donor`   | Address | Address of the donor |

**Data payload**

| Field              | Type      | Description                                          |
| ------------------ | --------- | ---------------------------------------------------- |
| `amount`           | `i128`    | Number of tokens donated (must be > 0)               |
| `charity_contract` | `Address` | Address of the charity contract that received tokens |

**Emitting functions**

- `donate_to_charity`

---

### `transfer`

Emitted for each individual waste ownership transfer. Published by both the v1 `transfer_waste` function and for every item in a `batch_transfer_waste` call, as well as `transfer_waste_v2`.

**Symbol key:** `transfer`

**Topic tuple**

| Position | Value      | Type           | Description                                                 |
| -------- | ---------- | -------------- | ----------------------------------------------------------- |
| 0        | `transfer` | Symbol         | Event identifier                                            |
| 1        | `waste_id` | `u64` / `u128` | ID of the transferred waste (v1 uses `u64`; v2 uses `u128`) |

**Data payload**

| Field       | Type      | Description                                              |
| ----------- | --------- | -------------------------------------------------------- |
| `from`      | `Address` | Previous owner (sender)                                  |
| `to`        | `Address` | New owner (recipient)                                    |
| `timestamp` | `u64`     | Ledger timestamp of the transfer (v2 only; absent in v1) |

> **Note:** The v1 `transfer_waste` function emits `(from, to)` as the data payload (no timestamp). The v2 `transfer_waste_v2` and `batch_transfer_waste` functions emit `(from, to, timestamp)`.

**Emitting functions**

- `transfer_waste` (v1, deprecated)
- `transfer_waste_v2`
- `batch_transfer_waste` (one event per waste item)

---

### `confirmed`

Emitted when a third-party participant confirms receipt of a v2 waste item.

**Symbol key:** `confirmed`

**Topic tuple**

| Position | Value       | Type   | Description               |
| -------- | ----------- | ------ | ------------------------- |
| 0        | `confirmed` | Symbol | Event identifier          |
| 1        | `waste_id`  | `u128` | ID of the confirmed waste |

**Data payload**

| Field       | Type      | Description                                      |
| ----------- | --------- | ------------------------------------------------ |
| `confirmer` | `Address` | Address of the participant who confirmed receipt |

**Emitting functions**

- `confirm_waste_details`

---

### `reg`

Emitted when a new participant is registered on-chain.

**Symbol key:** `reg`

**Topic tuple**

| Position | Value     | Type    | Description                                 |
| -------- | --------- | ------- | ------------------------------------------- |
| 0        | `reg`     | Symbol  | Event identifier                            |
| 1        | `address` | Address | Address of the newly registered participant |

**Data payload**

| Field       | Type     | Description                                                             |
| ----------- | -------- | ----------------------------------------------------------------------- |
| `role`      | `u32`    | Numeric role value: `0` = Recycler, `1` = Collector, `2` = Manufacturer |
| `name`      | `Symbol` | Short display name provided at registration                             |
| `latitude`  | `i128`   | Registration latitude in microdegrees                                   |
| `longitude` | `i128`   | Registration longitude in microdegrees                                  |

**Emitting functions**

- `register_participant`

---

### `rewarded`

Emitted each time tokens are transferred to a participant as a reward. Multiple `rewarded` events may be emitted in a single `reward_tokens` or `distribute_rewards` call — one per recipient (collectors in the transfer chain, the waste owner, and the recycler/submitter each receive a separate event).

**Symbol key:** `rewarded`

**Topic tuple**

| Position | Value       | Type    | Description                         |
| -------- | ----------- | ------- | ----------------------------------- |
| 0        | `rewarded`  | Symbol  | Event identifier                    |
| 1        | `recipient` | Address | Address receiving the reward tokens |

**Data payload**

| Field      | Type   | Description                                        |
| ---------- | ------ | -------------------------------------------------- |
| `amount`   | `u128` | Number of tokens rewarded                          |
| `waste_id` | `u64`  | ID of the v1 waste item associated with the reward |

**Emitting functions**

- `reward_tokens`
- `distribute_rewards` (emits one event per reward recipient)

---

### `loc_upd`

Emitted when a participant updates their registered location.

**Symbol key:** `loc_upd`

**Topic tuple**

| Position | Value     | Type    | Description                                       |
| -------- | --------- | ------- | ------------------------------------------------- |
| 0        | `loc_upd` | Symbol  | Event identifier                                  |
| 1        | `address` | Address | Address of the participant whose location changed |

**Data payload**

| Field       | Type   | Description                   |
| ----------- | ------ | ----------------------------- |
| `latitude`  | `i128` | New latitude in microdegrees  |
| `longitude` | `i128` | New longitude in microdegrees |

**Emitting functions**

- `update_participant_location`
- `update_location` (deprecated — delegates to `update_participant_location`)

---

### `adm_xfr`

Emitted when the admin list is replaced via `transfer_admin`.

**Symbol key:** `adm_xfr`

**Topic tuple**

| Position | Value     | Type   | Description      |
| -------- | --------- | ------ | ---------------- |
| 0        | `adm_xfr` | Symbol | Event identifier |

**Data payload**

| Field            | Type      | Description                                     |
| ---------------- | --------- | ----------------------------------------------- |
| `previous_admin` | `Address` | Address of the admin who initiated the transfer |

**Emitting functions**

- `transfer_admin`

---

### `paused`

Emitted when the contract is paused by an admin. While paused, all state-changing functions revert.

**Symbol key:** `paused`

**Topic tuple**

| Position | Value    | Type   | Description      |
| -------- | -------- | ------ | ---------------- |
| 0        | `paused` | Symbol | Event identifier |

**Data payload**

| Field   | Type      | Description                                  |
| ------- | --------- | -------------------------------------------- |
| `admin` | `Address` | Address of the admin who paused the contract |

**Emitting functions**

- `pause`

---

### `unpaused`

Emitted when the contract is unpaused by an admin, restoring normal operation.

**Symbol key:** `unpaused`

**Topic tuple**

| Position | Value      | Type   | Description      |
| -------- | ---------- | ------ | ---------------- |
| 0        | `unpaused` | Symbol | Event identifier |

**Data payload**

| Field   | Type      | Description                                    |
| ------- | --------- | ---------------------------------------------- |
| `admin` | `Address` | Address of the admin who unpaused the contract |

**Emitting functions**

- `unpause`

---

### `bulk_xfr`

Emitted when a collector transfers aggregated waste directly to a manufacturer via `transfer_collected_waste`. A new v2 waste record is created as part of this operation.

**Symbol key:** `bulk_xfr`

**Topic tuple**

| Position | Value      | Type   | Description                             |
| -------- | ---------- | ------ | --------------------------------------- |
| 0        | `bulk_xfr` | Symbol | Event identifier                        |
| 1        | `waste_id` | `u128` | ID of the newly created v2 waste record |

**Data payload**

| Field          | Type        | Description                                     |
| -------------- | ----------- | ----------------------------------------------- |
| `collector`    | `Address`   | Address of the collector sending the waste      |
| `manufacturer` | `Address`   | Address of the manufacturer receiving the waste |
| `waste_type`   | `WasteType` | Category of the aggregated waste                |
| `timestamp`    | `u64`       | Ledger timestamp of the transfer                |

**Emitting functions**

- `transfer_collected_waste`

---

### `reset`

Emitted when the confirmation status of a v2 waste item is reset by its owner.

**Symbol key:** `reset`

**Topic tuple**

| Position | Value      | Type   | Description                                  |
| -------- | ---------- | ------ | -------------------------------------------- |
| 0        | `reset`    | Symbol | Event identifier                             |
| 1        | `waste_id` | `u128` | ID of the waste whose confirmation was reset |

**Data payload**

| Field       | Type      | Description                                         |
| ----------- | --------- | --------------------------------------------------- |
| `owner`     | `Address` | Address of the current owner who reset confirmation |
| `timestamp` | `u64`     | Ledger timestamp of the reset                       |

**Emitting functions**

- `reset_waste_confirmation`

---

### `deactive`

Emitted when an admin permanently deactivates a v2 waste record. Deactivation is irreversible.

**Symbol key:** `deactive`

**Topic tuple**

| Position | Value      | Type   | Description                        |
| -------- | ---------- | ------ | ---------------------------------- |
| 0        | `deactive` | Symbol | Event identifier                   |
| 1        | `waste_id` | `u128` | ID of the deactivated waste record |

**Data payload**

| Field       | Type      | Description                                    |
| ----------- | --------- | ---------------------------------------------- |
| `admin`     | `Address` | Address of the admin who deactivated the waste |
| `timestamp` | `u64`     | Ledger timestamp of the deactivation           |

**Emitting functions**

- `deactivate_waste`

---

### `inc_upd`

Emitted when an incentive's reward points or total budget is updated by its creator.

**Symbol key:** `inc_upd`

**Topic tuple**

| Position | Value          | Type   | Description                 |
| -------- | -------------- | ------ | --------------------------- |
| 0        | `inc_upd`      | Symbol | Event identifier            |
| 1        | `incentive_id` | `u64`  | ID of the updated incentive |

**Data payload**

| Field               | Type      | Description                                        |
| ------------------- | --------- | -------------------------------------------------- |
| `rewarder`          | `Address` | Address of the manufacturer who owns the incentive |
| `new_reward_points` | `u64`     | Updated reward points per kg                       |
| `new_total_budget`  | `u64`     | Updated total token budget                         |

**Emitting functions**

- `update_incentive`

---

## Supply-Chain Transfer Rules

> **Cross-referenced from:** [`transfer_waste`](#transfer_waste), [`transfer_waste_v2`](#transfer_waste_v2), [`batch_transfer_waste`](#batch_transfer_waste)

Waste items may only move forward through the supply chain. The contract enforces a strict directed graph of permitted role-to-role transfers. Any attempt to transfer outside these routes is rejected with `InvalidTransferRoute` (error code 27).

### Permitted Routes

| From Role      | To Role        | Allowed |
| -------------- | -------------- | ------- |
| `Recycler`     | `Collector`    | ✅ Yes  |
| `Recycler`     | `Manufacturer` | ✅ Yes  |
| `Collector`    | `Manufacturer` | ✅ Yes  |
| `Recycler`     | `Recycler`     | ❌ No   |
| `Collector`    | `Collector`    | ❌ No   |
| `Manufacturer` | `Collector`    | ❌ No   |
| `Manufacturer` | `Recycler`     | ❌ No   |
| `Manufacturer` | `Manufacturer` | ❌ No   |

### Rules

1. **Three valid routes:** `Recycler → Collector`, `Recycler → Manufacturer`, `Collector → Manufacturer`.
2. **Same-role transfers are rejected.** A participant cannot transfer waste to another participant with the same role (e.g. Recycler → Recycler).
3. **Manufacturer → \* transfers are rejected.** A `Manufacturer` cannot be the sender in any transfer. Manufacturers are the terminal node in the supply chain.

### Error

Violations return `InvalidTransferRoute` — error code **27**. See the [Errors](#errors) section for the full error table.

---

## Reward Distribution

> **Cross-referenced from:** [`set_percentages`](#set_percentages), [`reward_tokens`](#reward_tokens), [`distribute_rewards`](#distribute_rewards)

This section explains how token rewards are calculated and split across supply-chain participants when waste is processed.

---

### RewardConfig Percentages

Reward distribution is governed by the `RewardConfig` struct, which holds two percentage values:

| Field                  | Type  | Default | Description                                                                     |
| ---------------------- | ----- | ------- | ------------------------------------------------------------------------------- |
| `collector_percentage` | `u32` | `5`     | Share (0–100) of the total reward given to each collector in the transfer chain |
| `owner_percentage`     | `u32` | `50`    | Share (0–100) of the total reward given to the current waste owner              |

The **remainder** (`100 - collector_percentage - owner_percentage`) goes to the original recycler/submitter.

**Default split (out of the box):**

| Recipient          | Percentage |
| ------------------ | ---------- |
| Collector(s)       | 5%         |
| Current owner      | 50%        |
| Recycler/submitter | 45%        |

> **Constraint:** `collector_percentage + owner_percentage` must not exceed 100. Attempting to set values that exceed this sum will be rejected.

---

### Changing the Percentages

Use `set_percentages` to update both values atomically:

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn set_percentages \
  -- --collector_percentage 10 --owner_percentage 60
```

You can also update each value independently via `set_collector_percentage` and `set_owner_percentage`. See the [Rewards & Tokens](#rewards-tokens) section for full function entries.

---

### Material Reward Points Formula

When a v1 `Material` is submitted, reward points are calculated using the `calculate_reward_points` method based on the waste type and weight.

**Formula:**

```
reward_points = (weight_grams / 1000) * multiplier * 10
```

**Multipliers by waste type:**

| Waste Type   | Variant Value | Multiplier | Example: 2 kg → points           |
| ------------ | ------------- | ---------- | -------------------------------- |
| `Paper`      | 0             | ×1         | (2000 / 1000) × 1 × 10 = **20**  |
| `PetPlastic` | 1             | ×3         | (2000 / 1000) × 3 × 10 = **60**  |
| `Plastic`    | 2             | ×2         | (2000 / 1000) × 2 × 10 = **40**  |
| `Metal`      | 3             | ×5         | (2000 / 1000) × 5 × 10 = **100** |
| `Glass`      | 4             | ×2         | (2000 / 1000) × 2 × 10 = **40**  |

> **Note:** `weight_grams` uses integer division, so weights below 1 000 g yield 0 points. The minimum meaningful weight for earning points is 1 000 g (1 kg).

**Examples:**

| Waste Type   | Weight (g) | Calculation             | Points |
| ------------ | ---------- | ----------------------- | ------ |
| `Paper`      | 500        | (500 / 1000) × 1 × 10   | 0      |
| `Paper`      | 1 000      | (1000 / 1000) × 1 × 10  | 10     |
| `Metal`      | 5 000      | (5000 / 1000) × 5 × 10  | 250    |
| `PetPlastic` | 3 000      | (3000 / 1000) × 3 × 10  | 90     |
| `Glass`      | 10 000     | (10000 / 1000) × 2 × 10 | 200    |

---

## Admin

This section documents all functions that manage contract administration: initialising the admin list, querying admins, transferring or modifying the admin set, and configuring the charity contract for donations.

---

### `initialize_admin`

> **Role restriction:** None — but must be called exactly once, immediately after deployment. The caller must sign the transaction.

**Signature**

```rust
pub fn initialize_admin(env: Env, admin: Address)
```

**Parameters**

| Parameter | Type      | Description                                                         |
| --------- | --------- | ------------------------------------------------------------------- |
| `admin`   | `Address` | Address that will hold admin privileges. Must sign the transaction. |

**Returns**

`()` — no return value.

**Errors / Panics**

| Condition                                 | Error / Panic                        |
| ----------------------------------------- | ------------------------------------ |
| Called more than once (admin already set) | Panics `"Admin already initialized"` |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ADMIN_SECRET \
  --fn initialize_admin \
  -- --admin GADMIN_ADDRESS
```

---

### `get_admin`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_admin(env: Env) -> Address
```

**Parameters**

_None._

**Returns**

The `Address` of the primary contract administrator (first entry in the admin list).

**Errors / Panics**

| Condition                              | Error / Panic             |
| -------------------------------------- | ------------------------- |
| `initialize_admin` has not been called | Panics `"Admin not set"`  |
| Admin list is empty (should not occur) | Panics `"No admin found"` |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_admin
```

---

### `get_admins`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_admins(env: Env) -> Vec<Address>
```

**Parameters**

_None._

**Returns**

A `Vec<Address>` containing all addresses that currently hold admin privileges.

**Errors / Panics**

| Condition                              | Error / Panic            |
| -------------------------------------- | ------------------------ |
| `initialize_admin` has not been called | Panics `"Admin not set"` |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_admins
```

---

### `transfer_admin`

> **Role restriction:** Admin only. `current_admin` must be in the admin list and must sign the transaction.

**Signature**

```rust
pub fn transfer_admin(env: Env, current_admin: Address, new_admins: Vec<Address>)
```

**Parameters**

| Parameter       | Type           | Description                                                                                 |
| --------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `current_admin` | `Address`      | The calling admin address. Must be in the current admin list and must sign the transaction. |
| `new_admins`    | `Vec<Address>` | Replacement admin list. Completely replaces the existing list. Must not be empty.           |

**Returns**

`()` — no return value.

**Errors / Panics**

| Condition                                | Error / Panic                                |
| ---------------------------------------- | -------------------------------------------- |
| `current_admin` is not in the admin list | Panics `"Unauthorized: caller is not admin"` |
| `new_admins` is empty                    | Panics `"Admin list cannot be empty"`        |
| `initialize_admin` has not been called   | Panics `"Admin not set"`                     |

**Emits**

- `adm_xfr` — emitted after the admin list is replaced, with `previous_admin` set to `current_admin`. See [adm_xfr](#adm_xfr).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ADMIN_SECRET \
  --fn transfer_admin \
  -- --current_admin GADMIN_ADDRESS --new_admins '[{"address":"GNEW_ADMIN_1"},{"address":"GNEW_ADMIN_2"}]'
```

> This call emits an `adm_xfr` event with `previous_admin = GADMIN_ADDRESS`.

---

### `add_admin`

> **Role restriction:** Admin only. `current_admin` must be in the admin list and must sign the transaction.

**Signature**

```rust
pub fn add_admin(env: Env, current_admin: Address, new_admin: Address)
```

**Parameters**

| Parameter       | Type      | Description                                                                                 |
| --------------- | --------- | ------------------------------------------------------------------------------------------- |
| `current_admin` | `Address` | The calling admin address. Must be in the current admin list and must sign the transaction. |
| `new_admin`     | `Address` | Address to add to the admin list. No-op if already present.                                 |

**Returns**

`()` — no return value. If `new_admin` is already in the list, the call succeeds silently without duplicating the entry.

**Errors / Panics**

| Condition                                | Error / Panic                                |
| ---------------------------------------- | -------------------------------------------- |
| `current_admin` is not in the admin list | Panics `"Unauthorized: caller is not admin"` |
| `initialize_admin` has not been called   | Panics `"Admin not set"`                     |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ADMIN_SECRET \
  --fn add_admin \
  -- --current_admin GADMIN_ADDRESS --new_admin GNEW_ADMIN_ADDRESS
```

---

### `remove_admin`

> **Role restriction:** Admin only. `current_admin` must be in the admin list and must sign the transaction.

**Signature**

```rust
pub fn remove_admin(env: Env, current_admin: Address, admin_to_remove: Address)
```

**Parameters**

| Parameter         | Type      | Description                                                                                 |
| ----------------- | --------- | ------------------------------------------------------------------------------------------- |
| `current_admin`   | `Address` | The calling admin address. Must be in the current admin list and must sign the transaction. |
| `admin_to_remove` | `Address` | Address to remove from the admin list.                                                      |

**Returns**

`()` — no return value.

**Errors / Panics**

| Condition                                | Error / Panic                                |
| ---------------------------------------- | -------------------------------------------- |
| `current_admin` is not in the admin list | Panics `"Unauthorized: caller is not admin"` |
| Only one admin remains in the list       | Panics `"Cannot remove the last admin"`      |
| `admin_to_remove` is not in the list     | Panics `"Admin to remove not found"`         |
| `initialize_admin` has not been called   | Panics `"Admin not set"`                     |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ADMIN_SECRET \
  --fn remove_admin \
  -- --current_admin GADMIN_ADDRESS --admin_to_remove GOLD_ADMIN_ADDRESS
```

---

### `set_charity_contract`

> **Role restriction:** Admin only. `admin` must be in the admin list and must sign the transaction.

**Signature**

```rust
pub fn set_charity_contract(env: Env, admin: Address, charity_address: Address)
```

**Parameters**

| Parameter         | Type      | Description                                                                                 |
| ----------------- | --------- | ------------------------------------------------------------------------------------------- |
| `admin`           | `Address` | The calling admin address. Must be in the current admin list and must sign the transaction. |
| `charity_address` | `Address` | Target charity contract address. Must differ from `admin`.                                  |

**Returns**

`()` — no return value.

**Errors / Panics**

| Condition                              | Error / Panic                                          |
| -------------------------------------- | ------------------------------------------------------ |
| `admin` is not in the admin list       | Panics `"Caller is not the contract admin"`            |
| `charity_address` equals `admin`       | Panics `"Charity address cannot be the same as admin"` |
| `initialize_admin` has not been called | Panics `"Contract admin has not been set"`             |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ADMIN_SECRET \
  --fn set_charity_contract \
  -- --admin GADMIN_ADDRESS --charity_address GCHARITY_CONTRACT_ADDRESS
```

---

### `get_charity_contract`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_charity_contract(env: Env) -> Option<Address>
```

**Parameters**

_None._

**Returns**

`Some(Address)` containing the configured charity contract address, or `None` if `set_charity_contract` has not been called.

**Errors / Panics**

_None._

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_charity_contract
```

---

### `donate_to_charity`

> **Role restriction:** Registered participant. `donor` must be registered (`is_registered == true`) and must sign the transaction.

**Signature**

```rust
pub fn donate_to_charity(env: Env, donor: Address, amount: i128)
```

**Parameters**

| Parameter | Type      | Description                                                                                                                                             |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `donor`   | `Address` | Registered participant making the donation. Must sign the transaction.                                                                                  |
| `amount`  | `i128`    | Number of tokens to donate. Must be > 0. Deducted from `donor.total_tokens_earned`. See [Requirement 2.4](#requirement-2-document-function-parameters). |

**Returns**

`()` — no return value. On success, `donor.total_tokens_earned` is reduced by `amount` and a `donated` event is emitted.

**Errors / Panics**

| Condition                               | Error / Panic                                        |
| --------------------------------------- | ---------------------------------------------------- |
| `amount` ≤ 0                            | Panics `"Donation amount must be greater than zero"` |
| `donor.total_tokens_earned` < `amount`  | Panics `"Insufficient balance"`                      |
| No charity address configured           | Panics `"Charity contract not set"`                  |
| `donor` is not a registered participant | Panics `"Caller is not a registered participant"`    |
| Contract is paused                      | Panics `"Contract is paused"`                        |

**Emits**

- `donated` — emitted after the balance is deducted, carrying `donor`, `amount`, and `charity_contract`. See [donated](#donated).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account DONOR_SECRET \
  --fn donate_to_charity \
  -- --donor GDONOR_ADDRESS --amount 100
```

> This call emits a `donated` event with `donor = GDONOR_ADDRESS`, `amount = 100`, and the configured charity contract address.

---

## Participant Management

Functions for registering, querying, updating, and deregistering supply-chain participants.

---

### `register_participant`

> **Role restriction:** None — any address may register itself.

**Signature**

```rust
pub fn register_participant(
    env: Env,
    address: Address,
    role: ParticipantRole,
    name: soroban_sdk::Symbol,
    latitude: i128,
    longitude: i128,
) -> Participant
```

**Parameters**

| Parameter   | Type              | Description                                                                                                                |
| ----------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `address`   | `Address`         | Stellar address of the participant being registered. Must sign the transaction.                                            |
| `role`      | `ParticipantRole` | Role in the supply chain: `Recycler` (0), `Collector` (1), or `Manufacturer` (2). See [ParticipantRole](#participantrole). |
| `name`      | `Symbol`          | Short display name (Soroban `Symbol`, max 32 chars).                                                                       |
| `latitude`  | `i128`            | Registration latitude in **microdegrees** (e.g. `52_520_000` = 52.52°N). Valid range: −90 000 000 to +90 000 000.          |
| `longitude` | `i128`            | Registration longitude in **microdegrees** (e.g. `13_405_000` = 13.405°E). Valid range: −180 000 000 to +180 000 000.      |

**Returns**

The newly created [`Participant`](#participant) record with `is_registered = true`, `total_waste_processed = 0`, `total_tokens_earned = 0`, and `registered_at` set to the current ledger timestamp.

**Errors / Panics**

| Condition                      | Error / Panic                             |
| ------------------------------ | ----------------------------------------- |
| Address is already registered  | Panics `"Participant already registered"` |
| `latitude` out of valid range  | Panics (from `validate_coordinates`)      |
| `longitude` out of valid range | Panics (from `validate_coordinates`)      |
| Contract is paused             | Panics `"Contract is paused"`             |

**Emits**

- `reg` — emitted after successful registration, carrying `(role_u32, name, latitude, longitude)` as data. See [reg](#reg).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ALICE_SECRET \
  --fn register_participant \
  -- --address GALICE_ADDRESS \
     --role '{"Recycler": null}' \
     --name alice \
     --latitude 52520000 \
     --longitude 13405000
```

> This call emits a `reg` event with the participant's address, role, name, and coordinates.

---

### `is_participant_registered`

> **Role restriction:** None — read-only, no authorization required.

**Signature**

```rust
pub fn is_participant_registered(env: Env, address: Address) -> bool
```

**Parameters**

| Parameter | Type      | Description                                |
| --------- | --------- | ------------------------------------------ |
| `address` | `Address` | Stellar address to check for registration. |

**Returns**

`true` if the address exists in storage and its `is_registered` field is `true`; `false` otherwise (including if the address has never been registered or has been deregistered).

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn is_participant_registered \
  -- --address GALICE_ADDRESS
```

---

### `get_participant`

> **Role restriction:** None — read-only, no authorization required.

**Signature**

```rust
pub fn get_participant(env: Env, address: Address) -> Option<Participant>
```

**Parameters**

| Parameter | Type      | Description                                     |
| --------- | --------- | ----------------------------------------------- |
| `address` | `Address` | Stellar address of the participant to retrieve. |

**Returns**

`Some(`[`Participant`](#participant)`)` if the address exists in storage (regardless of `is_registered` status); `None` if the address has never been registered.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_participant \
  -- --address GALICE_ADDRESS
```

---

### `get_participant_info`

> **Role restriction:** None — read-only, no authorization required.

**Signature**

```rust
pub fn get_participant_info(env: Env, address: Address) -> Option<ParticipantInfo>
```

**Parameters**

| Parameter | Type      | Description                                              |
| --------- | --------- | -------------------------------------------------------- |
| `address` | `Address` | Stellar address of the participant to retrieve info for. |

**Returns**

`Some(`[`ParticipantInfo`](#participantinfo)`)` containing the full `Participant` record and their `RecyclingStats` if the address is registered; `None` if the address is unknown. If stats have not yet been recorded, a zeroed `RecyclingStats` is returned.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_participant_info \
  -- --address GALICE_ADDRESS
```

---

### `get_participant_earnings`

> **Role restriction:** None — read-only, no authorization required.

**Signature**

```rust
pub fn get_participant_earnings(env: Env, address: Address) -> i128
```

**Parameters**

| Parameter | Type      | Description                                                    |
| --------- | --------- | -------------------------------------------------------------- |
| `address` | `Address` | Stellar address of the participant whose earnings to retrieve. |

**Returns**

The participant's `total_tokens_earned` cast to `i128`. Returns `0` if the address has never been registered.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_participant_earnings \
  -- --address GALICE_ADDRESS
```

---

### `get_all_participants`

> **Role restriction:** None — read-only, no authorization required.

**Signature**

```rust
pub fn get_all_participants(env: Env, offset: u32, limit: u32) -> Vec<Address>
```

**Parameters**

| Parameter | Type  | Description                                                                                                   |
| --------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| `offset`  | `u32` | Zero-based starting index into the participant index. Returns an empty vector if `offset` ≥ total count.      |
| `limit`   | `u32` | Maximum number of addresses to return. The actual count may be less if fewer participants exist after offset. |

**Returns**

A `Vec<Address>` of up to `limit` participant addresses starting at `offset`. Returns an empty vector if `offset` is beyond the end of the list.

**Errors / Panics**

None.

**Example**

```bash
# Fetch the first 10 participants
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_all_participants \
  -- --offset 0 --limit 10
```

---

### `update_role`

> **Role restriction:** The participant themselves — `address` must sign the transaction.

**Signature**

```rust
pub fn update_role(env: Env, address: Address, new_role: ParticipantRole) -> Participant
```

**Parameters**

| Parameter  | Type              | Description                                                                                                              |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `address`  | `Address`         | Stellar address of the participant whose role is being updated. Must sign the transaction.                               |
| `new_role` | `ParticipantRole` | The new role to assign: `Recycler` (0), `Collector` (1), or `Manufacturer` (2). See [ParticipantRole](#participantrole). |

**Returns**

The updated [`Participant`](#participant) record with the new role. All other fields (name, location, stats, timestamps) are preserved.

**Errors / Panics**

| Condition                               | Error / Panic                            |
| --------------------------------------- | ---------------------------------------- |
| Address not found in storage            | Panics `"Participant not found"`         |
| Participant has `is_registered = false` | Panics `"Participant is not registered"` |
| Contract is paused                      | Panics `"Contract is paused"`            |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ALICE_SECRET \
  --fn update_role \
  -- --address GALICE_ADDRESS --new-role '{"Collector": null}'
```

---

### `deregister_participant`

> **Role restriction:** The participant themselves — `address` must sign the transaction.

**Signature**

```rust
pub fn deregister_participant(env: Env, address: Address) -> Participant
```

**Parameters**

| Parameter | Type      | Description                                                                  |
| --------- | --------- | ---------------------------------------------------------------------------- |
| `address` | `Address` | Stellar address of the participant to deregister. Must sign the transaction. |

**Returns**

The updated [`Participant`](#participant) record with `is_registered = false`. The on-chain record is retained; the participant can no longer perform role-gated actions.

**Errors / Panics**

| Condition                    | Error / Panic                    |
| ---------------------------- | -------------------------------- |
| Address not found in storage | Panics `"Participant not found"` |
| Contract is paused           | Panics `"Contract is paused"`    |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ALICE_SECRET \
  --fn deregister_participant \
  -- --address GALICE_ADDRESS
```

---

### `update_participant_location`

> **Role restriction:** The participant themselves — `address` must sign the transaction.

**Signature**

```rust
pub fn update_participant_location(
    env: Env,
    address: Address,
    latitude: i128,
    longitude: i128,
) -> Participant
```

**Parameters**

| Parameter   | Type      | Description                                                                                                |
| ----------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `address`   | `Address` | Stellar address of the participant whose location is being updated. Must sign the transaction.             |
| `latitude`  | `i128`    | New latitude in **microdegrees** (e.g. `48_853_000` = 48.853°N). Valid range: −90 000 000 to +90 000 000.  |
| `longitude` | `i128`    | New longitude in **microdegrees** (e.g. `2_350_000` = 2.350°E). Valid range: −180 000 000 to +180 000 000. |

**Returns**

The updated [`Participant`](#participant) record with the new `latitude` and `longitude`. All other fields are preserved.

**Errors / Panics**

| Condition                               | Error / Panic                            |
| --------------------------------------- | ---------------------------------------- |
| `latitude` out of valid range           | Panics (from `validate_coordinates`)     |
| `longitude` out of valid range          | Panics (from `validate_coordinates`)     |
| Address not found in storage            | Panics `"Participant not found"`         |
| Participant has `is_registered = false` | Panics `"Participant is not registered"` |
| Contract is paused                      | Panics `"Contract is paused"`            |

**Emits**

- `loc_upd` — emitted after the location is updated, carrying `(latitude, longitude)` as data. See [loc_upd](#loc_upd).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ALICE_SECRET \
  --fn update_participant_location \
  -- --address GALICE_ADDRESS \
     --latitude 48853000 \
     --longitude 2350000
```

> This call emits a `loc_upd` event with `address = GALICE_ADDRESS`, `latitude = 48853000`, `longitude = 2350000`.

---

### `update_location`

> **Deprecated:** Use [`update_participant_location`](#update_participant_location) instead. `update_location` is a thin wrapper that delegates to `update_participant_location` with identical behavior, including coordinate validation and the `loc_upd` event emission.

> **Role restriction:** The participant themselves — `address` must sign the transaction.

**Signature**

```rust
pub fn update_location(
    env: Env,
    address: Address,
    latitude: i128,
    longitude: i128,
) -> Participant
```

**Parameters**

| Parameter   | Type      | Description                                                                                                |
| ----------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `address`   | `Address` | Stellar address of the participant whose location is being updated. Must sign the transaction.             |
| `latitude`  | `i128`    | New latitude in **microdegrees** (e.g. `48_853_000` = 48.853°N). Valid range: −90 000 000 to +90 000 000.  |
| `longitude` | `i128`    | New longitude in **microdegrees** (e.g. `2_350_000` = 2.350°E). Valid range: −180 000 000 to +180 000 000. |

**Returns**

The updated [`Participant`](#participant) record with the new `latitude` and `longitude`. Identical to the return value of `update_participant_location`.

**Errors / Panics**

| Condition                               | Error / Panic                            |
| --------------------------------------- | ---------------------------------------- |
| `latitude` out of valid range           | Panics (from `validate_coordinates`)     |
| `longitude` out of valid range          | Panics (from `validate_coordinates`)     |
| Address not found in storage            | Panics `"Participant not found"`         |
| Participant has `is_registered = false` | Panics `"Participant is not registered"` |
| Contract is paused                      | Panics `"Contract is paused"`            |

**Emits**

- `loc_upd` — same as `update_participant_location`. See [loc_upd](#loc_upd).

**Example**

```bash
# Deprecated — prefer update_participant_location
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ALICE_SECRET \
  --fn update_location \
  -- --address GALICE_ADDRESS \
     --latitude 48853000 \
     --longitude 2350000
```

---

## Waste (v1)

The v1 waste API uses `u64` IDs and `Material` records. For new integrations prefer the v2 API (`recycle_waste`, `transfer_waste_v2`, etc.) which adds GPS coordinates, `u128` IDs, and richer lifecycle tracking.

---

### `submit_material`

> **Role restriction:** Registered participant. `submitter` must sign the transaction.

**Signature**

```rust
pub fn submit_material(
    env: Env,
    waste_type: WasteType,
    weight: u64,
    submitter: Address,
    description: String,
) -> Material
```

**Parameters**

| Parameter     | Type        | Description                                                                |
| ------------- | ----------- | -------------------------------------------------------------------------- |
| `waste_type`  | `WasteType` | Category of the material. See [WasteType](#wastetype).                     |
| `weight`      | `u64`       | Weight in **grams**. Must be > 0 and ≤ 1 000 000 000 g (1 000 000 kg).     |
| `submitter`   | `Address`   | Registered participant submitting the material. Must sign the transaction. |
| `description` | `String`    | Free-text description of the material.                                     |

**Returns**

The newly created [`Material`](#material) record with a unique auto-incremented `id`, `verified = false`, and `submitted_at` set to the current ledger timestamp.

**Errors / Panics**

| Condition                     | Error / Panic                                     |
| ----------------------------- | ------------------------------------------------- |
| `submitter` is not registered | Panics `"Caller is not a registered participant"` |
| `weight` is 0                 | Panics `"Waste weight must be greater than zero"` |
| `weight` > 1 000 000 000      | Panics `"Waste weight exceeds maximum allowed"`   |
| Contract is paused            | Panics `"Contract is paused"`                     |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ALICE_SECRET \
  --fn submit_material \
  -- --waste_type '{"Plastic": null}' \
     --weight 2500 \
     --submitter GALICE_ADDRESS \
     --description "Mixed plastic bottles"
```

---

### `submit_materials_batch`

> **Role restriction:** Registered participant. The transaction signer must be a registered participant.

**Signature**

```rust
pub fn submit_materials_batch(
    env: Env,
    materials: Vec<(WasteType, u64, String)>,
    submitter: Address,
) -> Vec<Material>
```

**Parameters**

| Parameter   | Type                            | Description                                                                                              |
| ----------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `materials` | `Vec<(WasteType, u64, String)>` | List of `(waste_type, weight_grams, description)` tuples. Each weight must be > 0 and ≤ 1 000 000 000 g. |
| `submitter` | `Address`                       | Registered participant submitting all materials. Must sign the transaction.                              |

**Returns**

`Vec<Material>` — the newly created records in the same order as the input list.

**Errors / Panics**

| Condition                        | Error / Panic                                     |
| -------------------------------- | ------------------------------------------------- |
| `submitter` is not registered    | Panics `"Caller is not a registered participant"` |
| Any weight is 0                  | Panics `"Waste weight must be greater than zero"` |
| Batch weight sum overflows `u64` | Panics `"Overflow in batch weight"`               |
| Contract is paused               | Panics `"Contract is paused"`                     |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ALICE_SECRET \
  --fn submit_materials_batch \
  -- --materials '[["Plastic",1000,"Bottles"],["Metal",500,"Cans"]]' \
     --submitter GALICE_ADDRESS
```

---

### `verify_material`

> **Role restriction:** Registered `Recycler`. `verifier` must sign the transaction.

**Signature**

```rust
pub fn verify_material(env: Env, material_id: u64, verifier: Address) -> Material
```

**Parameters**

| Parameter     | Type      | Description                                                                   |
| ------------- | --------- | ----------------------------------------------------------------------------- |
| `material_id` | `u64`     | ID of the v1 material to verify.                                              |
| `verifier`    | `Address` | Registered `Recycler` performing the verification. Must sign the transaction. |

**Returns**

The updated [`Material`](#material) with `verified = true`. Token rewards are calculated and distributed to collectors, the current owner, and the recycler.

**Errors / Panics**

| Condition                           | Error / Panic                                  |
| ----------------------------------- | ---------------------------------------------- |
| `verifier` not found in storage     | Panics `"Verifier not registered"`             |
| `verifier.is_registered` is `false` | Panics `"Verifier is not registered"`          |
| `verifier` role is not `Recycler`   | Panics `"Only recyclers can verify materials"` |
| `material_id` not found             | Panics `"Material not found"`                  |
| Contract is paused                  | Panics `"Contract is paused"`                  |

**Emits**

- `rewarded` — one event per reward recipient (collectors, owner, recycler). See [rewarded](#rewarded).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account RECYCLER_SECRET \
  --fn verify_material \
  -- --material_id 1 --verifier GRECYCLER_ADDRESS
```

---

### `verify_materials_batch`

> **Role restriction:** Registered `Recycler`. `verifier` must sign the transaction.

**Signature**

```rust
pub fn verify_materials_batch(
    env: Env,
    material_ids: Vec<u64>,
    verifier: Address,
) -> Vec<Material>
```

**Parameters**

| Parameter      | Type       | Description                                                                   |
| -------------- | ---------- | ----------------------------------------------------------------------------- |
| `material_ids` | `Vec<u64>` | IDs of v1 materials to verify. Non-existent IDs are silently skipped.         |
| `verifier`     | `Address`  | Registered `Recycler` performing the verification. Must sign the transaction. |

**Returns**

`Vec<Material>` containing only the materials that were found and successfully verified.

**Errors / Panics**

| Condition                         | Error / Panic                                  |
| --------------------------------- | ---------------------------------------------- |
| `verifier` not found in storage   | Panics `"Verifier not registered"`             |
| `verifier` role is not `Recycler` | Panics `"Only recyclers can verify materials"` |
| Contract is paused                | Panics `"Contract is paused"`                  |

**Emits**

- `rewarded` — one event per reward recipient per verified material.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account RECYCLER_SECRET \
  --fn verify_materials_batch \
  -- --material_ids '[1,2,3]' --verifier GRECYCLER_ADDRESS
```

---

### `get_material`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_material(env: Env, material_id: u64) -> Option<Material>
```

**Parameters**

| Parameter     | Type  | Description                        |
| ------------- | ----- | ---------------------------------- |
| `material_id` | `u64` | ID of the v1 material to retrieve. |

**Returns**

`Some(`[`Material`](#material)`)` if found; `None` if no record exists for that ID. Alias for `get_waste`.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_material \
  -- --material_id 1
```

---

### `get_waste`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_waste(env: Env, waste_id: u64) -> Option<Material>
```

**Parameters**

| Parameter  | Type  | Description                        |
| ---------- | ----- | ---------------------------------- |
| `waste_id` | `u64` | ID of the v1 material to retrieve. |

**Returns**

`Some(`[`Material`](#material)`)` if found; `None` otherwise. This is the canonical v1 lookup function.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_waste \
  -- --waste_id 1
```

---

### `get_waste_by_id`

> **Deprecated:** Use [`get_waste`](#get_waste) or [`get_material`](#get_material) instead. This is an exact alias and will be removed in a future release.

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_waste_by_id(env: Env, waste_id: u64) -> Option<Material>
```

**Parameters**

| Parameter  | Type  | Description                        |
| ---------- | ----- | ---------------------------------- |
| `waste_id` | `u64` | ID of the v1 material to retrieve. |

**Returns**

`Some(`[`Material`](#material)`)` if found; `None` otherwise. Identical to `get_waste`.

**Errors / Panics**

None.

**Example**

```bash
# Deprecated — prefer get_material
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_waste_by_id \
  -- --waste_id 1
```

---

### `get_wastes_batch`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_wastes_batch(env: Env, waste_ids: Vec<u64>) -> Vec<Option<Material>>
```

**Parameters**

| Parameter   | Type       | Description                                   |
| ----------- | ---------- | --------------------------------------------- |
| `waste_ids` | `Vec<u64>` | List of v1 material IDs to fetch in one call. |

**Returns**

`Vec<Option<Material>>` in the same order as `waste_ids`. Each element is `None` if the corresponding ID does not exist.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_wastes_batch \
  -- --waste_ids '[1,2,3,4,5]'
```

---

### `get_participant_wastes`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_participant_wastes(env: Env, participant: Address) -> Vec<u64>
```

**Parameters**

| Parameter     | Type      | Description                                                     |
| ------------- | --------- | --------------------------------------------------------------- |
| `participant` | `Address` | Stellar address of the participant whose waste IDs to retrieve. |

**Returns**

`Vec<u64>` of v1 waste IDs where `material.submitter == participant`. Performs a linear scan — for large datasets prefer [`get_participant_wastes_v2`](#get_participant_wastes_v2).

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_participant_wastes \
  -- --participant GALICE_ADDRESS
```

---

### `waste_exists`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn waste_exists(env: Env, waste_id: u64) -> bool
```

**Parameters**

| Parameter  | Type  | Description                     |
| ---------- | ----- | ------------------------------- |
| `waste_id` | `u64` | ID of the v1 material to check. |

**Returns**

`true` if a record exists in storage for `waste_id`; `false` otherwise.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn waste_exists \
  -- --waste_id 1
```

---

### `get_waste_type_string`

> **Role restriction:** None — read-only, pure utility.

**Signature**

```rust
pub fn get_waste_type_string(env: Env, waste_type: WasteType) -> String
```

**Parameters**

| Parameter    | Type        | Description                                                          |
| ------------ | ----------- | -------------------------------------------------------------------- |
| `waste_type` | `WasteType` | The waste type enum variant to convert. See [WasteType](#wastetype). |

**Returns**

A Soroban `String` representation: `"Paper"`, `"PetPlastic"`, `"Plastic"`, `"Metal"`, or `"Glass"`.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_waste_type_string \
  -- --waste_type '{"Metal": null}'
# Returns: "Metal"
```

---

### `get_participant_role_string`

> **Role restriction:** None — read-only, pure utility.

**Signature**

```rust
pub fn get_participant_role_string(env: Env, role: ParticipantRole) -> String
```

**Parameters**

| Parameter | Type              | Description                                                                |
| --------- | ----------------- | -------------------------------------------------------------------------- |
| `role`    | `ParticipantRole` | The role enum variant to convert. See [ParticipantRole](#participantrole). |

**Returns**

A Soroban `String`: `"Recycler"`, `"Collector"`, or `"Manufacturer"`.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_participant_role_string \
  -- --role '{"Collector": null}'
# Returns: "Collector"
```

---

### `transfer_waste`

> **Deprecated:** Use [`transfer_waste_v2`](#transfer_waste_v2) instead. This function uses `u64` IDs and does not record GPS coordinates.

> **Role restriction:** Registered participant. `from` must own the waste and must sign the transaction.

> **See also:** [Supply-Chain Transfer Rules](#supply-chain-transfer-rules) — the same role-based routing rules apply.

**Signature**

```rust
pub fn transfer_waste(
    env: Env,
    waste_id: u64,
    from: Address,
    to: Address,
    note: String,
) -> Material
```

**Parameters**

| Parameter  | Type      | Description                                                                           |
| ---------- | --------- | ------------------------------------------------------------------------------------- |
| `waste_id` | `u64`     | ID of the v1 material to transfer.                                                    |
| `from`     | `Address` | Current owner of the waste. Must sign the transaction.                                |
| `to`       | `Address` | Recipient. Must be a registered participant with a valid role for the transfer route. |
| `note`     | `String`  | Short note attached to the transfer record.                                           |

**Returns**

The updated [`Material`](#material) with `submitter` set to `to`.

**Errors / Panics**

| Condition                                 | Error / Panic                                             |
| ----------------------------------------- | --------------------------------------------------------- |
| `from` is not registered                  | Panics `"Caller is not a registered participant"`         |
| `to` is not registered                    | Panics `"Caller is not a registered participant"`         |
| `from` does not own the waste             | Panics `"Only waste owner can transfer"`                  |
| `from` and `to` are the same address      | Panics (from `require_addresses_different`)               |
| Transfer route is invalid (role mismatch) | Panics `"Invalid transfer: role combination not allowed"` |
| `waste_id` not found                      | Panics `"Waste not found"`                                |
| Contract is paused                        | Panics `"Contract is paused"`                             |

**Emits**

- `transfer` — emitted with `(waste_id, from, to)` (no timestamp in v1). See [transfer](#transfer).

**Example**

```bash
# Deprecated — prefer transfer_waste_v2
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ALICE_SECRET \
  --fn transfer_waste \
  -- --waste_id 1 \
     --from GALICE_ADDRESS \
     --to GCOLLECTOR_ADDRESS \
     --note "batch-01"
```

---

### `get_transfer_history`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_transfer_history(env: Env, waste_id: u64) -> Vec<WasteTransfer>
```

**Parameters**

| Parameter  | Type  | Description                                          |
| ---------- | ----- | ---------------------------------------------------- |
| `waste_id` | `u64` | ID of the waste item whose transfer log to retrieve. |

**Returns**

Chronologically ordered `Vec<`[`WasteTransfer`](#wastetransfer)`>`. Returns an empty vector if no transfers have been recorded.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_transfer_history \
  -- --waste_id 1
```

---

### `get_waste_transfer_history`

> **Role restriction:** None — read-only. Alias for [`get_transfer_history`](#get_transfer_history).

**Signature**

```rust
pub fn get_waste_transfer_history(env: Env, waste_id: u64) -> Vec<WasteTransfer>
```

**Parameters**

| Parameter  | Type  | Description                                          |
| ---------- | ----- | ---------------------------------------------------- |
| `waste_id` | `u64` | ID of the waste item whose transfer log to retrieve. |

**Returns**

Identical to `get_transfer_history` — chronologically ordered `Vec<WasteTransfer>`.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_waste_transfer_history \
  -- --waste_id 1
```

---

### `get_transfers_from`

> **Role restriction:** None — read-only.

> **Note:** Currently returns an empty list. A sender index is not yet implemented.

**Signature**

```rust
pub fn get_transfers_from(env: Env, _address: Address) -> Vec<(u64, Vec<WasteTransfer>)>
```

**Parameters**

| Parameter  | Type      | Description                                 |
| ---------- | --------- | ------------------------------------------- |
| `_address` | `Address` | Sender address to query (currently unused). |

**Returns**

Always returns an empty `Vec` in the current implementation. A future release will return all outbound transfers grouped by waste ID.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_transfers_from \
  -- --address GALICE_ADDRESS
```

---

### `get_transfers_to`

> **Role restriction:** None — read-only.

> **Note:** Currently returns an empty list. A receiver index is not yet implemented.

**Signature**

```rust
pub fn get_transfers_to(env: Env, _address: Address) -> Vec<(u64, Vec<WasteTransfer>)>
```

**Parameters**

| Parameter  | Type      | Description                                    |
| ---------- | --------- | ---------------------------------------------- |
| `_address` | `Address` | Recipient address to query (currently unused). |

**Returns**

Always returns an empty `Vec` in the current implementation.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_transfers_to \
  -- --address GCOLLECTOR_ADDRESS
```

---

### `can_collect`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn can_collect(env: Env, address: Address) -> bool
```

**Parameters**

| Parameter | Type      | Description               |
| --------- | --------- | ------------------------- |
| `address` | `Address` | Stellar address to check. |

**Returns**

`true` if the participant is registered and their role is `Recycler` or `Collector`; `false` otherwise (including unknown addresses).

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn can_collect \
  -- --address GALICE_ADDRESS
```

---

### `can_manufacture`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn can_manufacture(env: Env, address: Address) -> bool
```

**Parameters**

| Parameter | Type      | Description               |
| --------- | --------- | ------------------------- |
| `address` | `Address` | Stellar address to check. |

**Returns**

`true` if the participant is registered and their role is `Manufacturer`; `false` otherwise.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn can_manufacture \
  -- --address GMANUFACTURER_ADDRESS
```

---

## Waste (v2)

The v2 waste API uses `u128` IDs, GPS coordinates, and richer lifecycle tracking (confirmation, deactivation). Prefer v2 for all new integrations.

---

### `recycle_waste`

> **Role restriction:** Registered participant. `recycler` must sign the transaction.

**Signature**

```rust
pub fn recycle_waste(
    env: Env,
    waste_type: WasteType,
    weight: u128,
    recycler: Address,
    latitude: i128,
    longitude: i128,
) -> u128
```

**Parameters**

| Parameter    | Type        | Description                                                                                                         |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `waste_type` | `WasteType` | Category of the waste. See [WasteType](#wastetype).                                                                 |
| `weight`     | `u128`      | Weight in **grams**. Must be > 0 and ≤ 1 000 000 000 g (1 000 000 kg).                                              |
| `recycler`   | `Address`   | Registered participant creating the record. Must sign the transaction.                                              |
| `latitude`   | `i128`      | Collection latitude in **microdegrees** (e.g. `52_520_000` = 52.52°N). Valid range: −90 000 000 to +90 000 000.     |
| `longitude`  | `i128`      | Collection longitude in **microdegrees** (e.g. `13_405_000` = 13.405°E). Valid range: −180 000 000 to +180 000 000. |

**Returns**

The new waste ID (`u128`). The waste record is stored with `is_active = true`, `is_confirmed = false`, and `current_owner = recycler`.

**Errors / Panics**

| Condition                    | Error / Panic                                     |
| ---------------------------- | ------------------------------------------------- |
| `recycler` is not registered | Panics `"Caller is not a registered participant"` |
| `weight` is 0                | Panics `"Waste weight must be greater than zero"` |
| `weight` > 1 000 000 000     | Panics `"Waste weight exceeds maximum allowed"`   |
| Contract is paused           | Panics `"Contract is paused"`                     |

**Emits**

- `recycled` — emitted with `(waste_id, waste_type, weight, recycler, latitude, longitude)`. See [recycled](#recycled).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ALICE_SECRET \
  --fn recycle_waste \
  -- --waste_type '{"Plastic": null}' \
     --weight 5000 \
     --recycler GALICE_ADDRESS \
     --latitude 52520000 \
     --longitude 13405000
```

> This call emits a `recycled` event with the new waste ID.

---

### `get_waste_v2`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_waste_v2(env: Env, waste_id: u128) -> Option<Waste>
```

**Parameters**

| Parameter  | Type   | Description                         |
| ---------- | ------ | ----------------------------------- |
| `waste_id` | `u128` | ID of the v2 waste record to fetch. |

**Returns**

`Some(`[`Waste`](#waste)`)` if found; `None` if no v2 record exists for that ID.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_waste_v2 \
  -- --waste_id 1
```

---

### `get_participant_wastes_v2`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_participant_wastes_v2(env: Env, participant: Address) -> Vec<u128>
```

**Parameters**

| Parameter     | Type      | Description                                                     |
| ------------- | --------- | --------------------------------------------------------------- |
| `participant` | `Address` | Stellar address of the participant whose waste IDs to retrieve. |

**Returns**

`Vec<u128>` of v2 waste IDs currently owned by `participant`. Returns an empty vector if the participant owns none. Uses an indexed list — O(1) lookup, unlike the v1 linear scan.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_participant_wastes_v2 \
  -- --participant GALICE_ADDRESS
```

---

### `transfer_waste_v2`

> **Role restriction:** Registered participant. `from` must own the waste and must sign the transaction.

> **See also:** [Supply-Chain Transfer Rules](#supply-chain-transfer-rules) — only `Recycler → Collector`, `Recycler → Manufacturer`, and `Collector → Manufacturer` are permitted.

**Signature**

```rust
pub fn transfer_waste_v2(
    env: Env,
    waste_id: u128,
    from: Address,
    to: Address,
    latitude: i128,
    longitude: i128,
) -> Result<WasteTransfer, Error>
```

**Parameters**

| Parameter   | Type      | Description                                                                                 |
| ----------- | --------- | ------------------------------------------------------------------------------------------- |
| `waste_id`  | `u128`    | ID of the v2 waste to transfer.                                                             |
| `from`      | `Address` | Current owner. Must sign the transaction.                                                   |
| `to`        | `Address` | Recipient. Must be a registered participant with a valid role for the transfer route.       |
| `latitude`  | `i128`    | Transfer location latitude in **microdegrees**. Valid range: −90 000 000 to +90 000 000.    |
| `longitude` | `i128`    | Transfer location longitude in **microdegrees**. Valid range: −180 000 000 to +180 000 000. |

**Returns**

`Ok(`[`WasteTransfer`](#wastetransfer)`)` — the transfer record appended to history. Returns `Err(Error)` on failure.

**Errors / Panics**

| Condition                            | Error / Panic                                         |
| ------------------------------------ | ----------------------------------------------------- |
| `waste_id` not found                 | `Err(Error::WasteNotFound)` (code 7)                  |
| Waste is deactivated                 | `Err(Error::WasteDeactivated)` (code 18)              |
| Transfer route is invalid            | `Err(Error::InvalidTransferRoute)` (code 27)          |
| `from` does not own the waste        | Panics `"Caller is not the owner of this waste item"` |
| `from` and `to` are the same address | Panics (from `require_addresses_different`)           |
| Contract is paused                   | Panics `"Contract is paused"`                         |

**Emits**

- `transfer` — emitted with `(waste_id, from, to, timestamp)`. See [transfer](#transfer).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ALICE_SECRET \
  --fn transfer_waste_v2 \
  -- --waste_id 1 \
     --from GALICE_ADDRESS \
     --to GCOLLECTOR_ADDRESS \
     --latitude 52520000 \
     --longitude 13405000
```

---

### `batch_transfer_waste`

> **Role restriction:** Each waste item's current owner must sign. All owners must be registered.

> **See also:** [Supply-Chain Transfer Rules](#supply-chain-transfer-rules).

> **Edge case:** Passing an empty `waste_ids` list returns `Ok([])` immediately without error.

**Signature**

```rust
pub fn batch_transfer_waste(
    env: Env,
    waste_ids: Vec<u128>,
    to: Address,
    latitude: i128,
    longitude: i128,
) -> Result<Vec<WasteTransfer>, Error>
```

**Parameters**

| Parameter   | Type        | Description                                                                                 |
| ----------- | ----------- | ------------------------------------------------------------------------------------------- |
| `waste_ids` | `Vec<u128>` | IDs of v2 waste items to transfer. All must be active and owned by valid senders.           |
| `to`        | `Address`   | Single recipient for all items. Must be a registered participant.                           |
| `latitude`  | `i128`      | Transfer location latitude in **microdegrees**. Valid range: −90 000 000 to +90 000 000.    |
| `longitude` | `i128`      | Transfer location longitude in **microdegrees**. Valid range: −180 000 000 to +180 000 000. |

**Returns**

`Ok(Vec<`[`WasteTransfer`](#wastetransfer)`>)` — one record per transferred item. Returns `Err(Error)` if any validation fails (atomic — no partial transfers).

**Errors / Panics**

| Condition                     | Error / Panic                                     |
| ----------------------------- | ------------------------------------------------- |
| Any `waste_id` not found      | `Err(Error::WasteNotFound)` (code 7)              |
| Any waste is deactivated      | `Err(Error::WasteDeactivated)` (code 18)          |
| Any transfer route is invalid | `Err(Error::InvalidTransferRoute)` (code 27)      |
| Any sender equals `to`        | `Err(Error::SameAddress)` (code 28)               |
| `to` is not registered        | Panics `"Caller is not a registered participant"` |
| Contract is paused            | Panics `"Contract is paused"`                     |

**Emits**

- `transfer` — one event per waste item. See [transfer](#transfer).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ALICE_SECRET \
  --fn batch_transfer_waste \
  -- --waste_ids '[1,2,3]' \
     --to GCOLLECTOR_ADDRESS \
     --latitude 52520000 \
     --longitude 13405000
```

**Edge case — empty batch:**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn batch_transfer_waste \
  -- --waste_ids '[]' \
     --to GCOLLECTOR_ADDRESS \
     --latitude 0 \
     --longitude 0
# Returns: Ok([])
```

---

### `transfer_collected_waste`

> **Role restriction:** `collector` must be a registered `Collector` and must sign. `manufacturer` must be a registered `Manufacturer`.

**Signature**

```rust
pub fn transfer_collected_waste(
    env: Env,
    waste_type: WasteType,
    collector: Address,
    manufacturer: Address,
    latitude: i128,
    longitude: i128,
    notes: Symbol,
) -> u128
```

**Parameters**

| Parameter      | Type        | Description                                                                                |
| -------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `waste_type`   | `WasteType` | Category of the aggregated waste. See [WasteType](#wastetype).                             |
| `collector`    | `Address`   | Registered `Collector` sending the waste. Must sign the transaction.                       |
| `manufacturer` | `Address`   | Registered `Manufacturer` receiving the waste.                                             |
| `latitude`     | `i128`      | Handoff location latitude in **microdegrees**. Valid range: −90 000 000 to +90 000 000.    |
| `longitude`    | `i128`      | Handoff location longitude in **microdegrees**. Valid range: −180 000 000 to +180 000 000. |
| `notes`        | `Symbol`    | Short symbol note attached to the transfer record.                                         |

**Returns**

The new waste ID (`u128`). A new v2 waste record is created owned by `manufacturer`.

**Errors / Panics**

| Condition                                   | Error / Panic                                     |
| ------------------------------------------- | ------------------------------------------------- |
| `collector` is not registered               | Panics `"Caller is not a registered participant"` |
| `collector` role is not `Collector`         | Panics `"Only collectors can use this"`           |
| `manufacturer` is not registered            | Panics `"Manufacturer not registered"`            |
| `manufacturer` role is not `Manufacturer`   | Panics `"Recipient must be manufacturer"`         |
| `collector` and `manufacturer` are the same | Panics (from `require_addresses_different`)       |
| Contract is paused                          | Panics `"Contract is paused"`                     |

**Emits**

- `bulk_xfr` — emitted with `(waste_id, collector, manufacturer, waste_type, timestamp)`. See [bulk_xfr](#bulk_xfr).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account COLLECTOR_SECRET \
  --fn transfer_collected_waste \
  -- --waste_type '{"Metal": null}' \
     --collector GCOLLECTOR_ADDRESS \
     --manufacturer GMANUFACTURER_ADDRESS \
     --latitude 48853000 \
     --longitude 2350000 \
     --notes batch42
```

---

### `confirm_waste_details`

> **Role restriction:** Registered participant. `confirmer` must **not** be the current owner of the waste.

**Signature**

```rust
pub fn confirm_waste_details(env: Env, waste_id: u128, confirmer: Address) -> Waste
```

**Parameters**

| Parameter   | Type      | Description                                                                          |
| ----------- | --------- | ------------------------------------------------------------------------------------ |
| `waste_id`  | `u128`    | ID of the v2 waste to confirm.                                                       |
| `confirmer` | `Address` | Registered participant confirming receipt. Must sign. Must not be the current owner. |

**Returns**

The updated [`Waste`](#waste) with `is_confirmed = true` and `confirmer` set to the caller's address.

**Errors / Panics**

| Condition                        | Error / Panic                                     |
| -------------------------------- | ------------------------------------------------- |
| `waste_id` not found             | Panics `"Waste not found"`                        |
| Waste is deactivated             | Panics `"Cannot confirm deactivated waste"`       |
| `confirmer` is the current owner | Panics `"Owner cannot confirm own waste"`         |
| Waste is already confirmed       | Panics `"Waste already confirmed"`                |
| `confirmer` is not registered    | Panics `"Caller is not a registered participant"` |
| Contract is paused               | Panics `"Contract is paused"`                     |

**Emits**

- `confirmed` — emitted with `(waste_id, confirmer)`. See [confirmed](#confirmed).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account BOB_SECRET \
  --fn confirm_waste_details \
  -- --waste_id 1 --confirmer GBOB_ADDRESS
```

---

### `reset_waste_confirmation`

> **Role restriction:** Current owner of the waste. `owner` must sign the transaction.

**Signature**

```rust
pub fn reset_waste_confirmation(env: Env, waste_id: u128, owner: Address) -> Waste
```

**Parameters**

| Parameter  | Type      | Description                                            |
| ---------- | --------- | ------------------------------------------------------ |
| `waste_id` | `u128`    | ID of the v2 waste whose confirmation to reset.        |
| `owner`    | `Address` | Current owner of the waste. Must sign the transaction. |

**Returns**

The updated [`Waste`](#waste) with `is_confirmed = false`.

**Errors / Panics**

| Condition                      | Error / Panic                                         |
| ------------------------------ | ----------------------------------------------------- |
| `owner` does not own the waste | Panics `"Caller is not the owner of this waste item"` |
| `waste_id` not found           | Panics `"Waste item not found"`                       |
| Waste is not confirmed         | Panics `"Waste is not confirmed"`                     |
| Contract is paused             | Panics `"Contract is paused"`                         |

**Emits**

- `reset` — emitted with `(waste_id, owner, timestamp)`. See [reset](#reset).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ALICE_SECRET \
  --fn reset_waste_confirmation \
  -- --waste_id 1 --owner GALICE_ADDRESS
```

---

### `deactivate_waste`

> **Role restriction:** Admin only. `admin` must be in the admin list and must sign the transaction.

**Signature**

```rust
pub fn deactivate_waste(env: Env, waste_id: u128, admin: Address) -> Waste
```

**Parameters**

| Parameter  | Type      | Description                                   |
| ---------- | --------- | --------------------------------------------- |
| `waste_id` | `u128`    | ID of the v2 waste to permanently deactivate. |
| `admin`    | `Address` | Contract admin. Must sign the transaction.    |

**Returns**

The updated [`Waste`](#waste) with `is_active = false`. Deactivation is irreversible — the waste can no longer be transferred or confirmed.

**Errors / Panics**

| Condition                        | Error / Panic                               |
| -------------------------------- | ------------------------------------------- |
| `admin` is not in the admin list | Panics `"Caller is not the contract admin"` |
| `waste_id` not found             | Panics `"Waste item not found"`             |
| Waste is already deactivated     | Panics `"Waste already deactivated"`        |

**Emits**

- `deactive` — emitted with `(waste_id, admin, timestamp)`. See [deactive](#deactive).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ADMIN_SECRET \
  --fn deactivate_waste \
  -- --waste_id 1 --admin GADMIN_ADDRESS
```

---

### `get_waste_transfer_history_v2`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_waste_transfer_history_v2(env: Env, waste_id: u128) -> Vec<WasteTransfer>
```

**Parameters**

| Parameter  | Type   | Description                                            |
| ---------- | ------ | ------------------------------------------------------ |
| `waste_id` | `u128` | ID of the v2 waste whose transfer history to retrieve. |

**Returns**

Chronologically ordered `Vec<`[`WasteTransfer`](#wastetransfer)`>`. Returns an empty vector if no transfers have been recorded.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_waste_transfer_history_v2 \
  -- --waste_id 1
```

---

### `is_valid_transfer`

> **Role restriction:** None — read-only utility.

**Signature**

```rust
pub fn is_valid_transfer(env: Env, from: Address, to: Address) -> bool
```

**Parameters**

| Parameter | Type      | Description                              |
| --------- | --------- | ---------------------------------------- |
| `from`    | `Address` | Sender address whose role is checked.    |
| `to`      | `Address` | Recipient address whose role is checked. |

**Returns**

`true` if the role combination (`from` → `to`) is a permitted transfer route; `false` otherwise. See [Supply-Chain Transfer Rules](#supply-chain-transfer-rules) for the full route table.

**Errors / Panics**

None. Returns `false` if either address is not registered.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn is_valid_transfer \
  -- --from GRECYCLER_ADDRESS --to GCOLLECTOR_ADDRESS
# Returns: true

soroban contract invoke \
  --id CONTRACT_ID \
  --fn is_valid_transfer \
  -- --from GMANUFACTURER_ADDRESS --to GCOLLECTOR_ADDRESS
# Returns: false
```

---

## Incentives

Manufacturer-created reward programs that offer tokens for recycling specific waste types.

---

### `create_incentive`

> **Role restriction:** Registered `Manufacturer`. `rewarder` must sign the transaction.

**Signature**

```rust
pub fn create_incentive(
    env: Env,
    rewarder: Address,
    waste_type: WasteType,
    reward_points: u64,
    total_budget: u64,
) -> Incentive
```

**Parameters**

| Parameter       | Type        | Description                                                                  |
| --------------- | ----------- | ---------------------------------------------------------------------------- |
| `rewarder`      | `Address`   | Registered `Manufacturer` creating the incentive. Must sign the transaction. |
| `waste_type`    | `WasteType` | The waste type this incentive rewards. See [WasteType](#wastetype).          |
| `reward_points` | `u64`       | Tokens awarded per kilogram of qualifying waste.                             |
| `total_budget`  | `u64`       | Maximum total tokens this incentive can distribute.                          |

**Returns**

The newly created [`Incentive`](#incentive) with `active = true`, `remaining_budget = total_budget`, and `created_at` set to the current ledger timestamp.

**Errors / Panics**

| Condition                          | Error / Panic                                     |
| ---------------------------------- | ------------------------------------------------- |
| `rewarder` is not a `Manufacturer` | Panics `"Caller is not a manufacturer"`           |
| `rewarder` is not registered       | Panics `"Caller is not a registered participant"` |
| Contract is paused                 | Panics `"Contract is paused"`                     |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account MFR_SECRET \
  --fn create_incentive \
  -- --rewarder GMANUFACTURER_ADDRESS \
     --waste_type '{"Plastic": null}' \
     --reward_points 50 \
     --total_budget 10000
```

---

### `update_incentive`

> **Role restriction:** The original `rewarder` (incentive creator). Must sign the transaction.

**Signature**

```rust
pub fn update_incentive(
    env: Env,
    incentive_id: u64,
    new_reward_points: u64,
    new_total_budget: u64,
) -> Incentive
```

**Parameters**

| Parameter           | Type  | Description                                                                                                                                                        |
| ------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `incentive_id`      | `u64` | ID of the incentive to update.                                                                                                                                     |
| `new_reward_points` | `u64` | New tokens per kg. Must be > 0.                                                                                                                                    |
| `new_total_budget`  | `u64` | New total budget. Must be > 0. `remaining_budget` is recalculated as `new_total_budget - budget_used`. If `new_total_budget ≤ budget_used`, incentive deactivates. |

**Returns**

The updated [`Incentive`](#incentive) with new `reward_points`, `total_budget`, and recalculated `remaining_budget`.

**Errors / Panics**

| Condition                | Error / Panic                                     |
| ------------------------ | ------------------------------------------------- |
| `incentive_id` not found | Panics `"Incentive not found"`                    |
| Incentive is not active  | Panics `"Incentive is not active"`                |
| `new_reward_points` is 0 | Panics `"Reward must be greater than zero"`       |
| `new_total_budget` is 0  | Panics `"Total budget must be greater than zero"` |
| Contract is paused       | Panics `"Contract is paused"`                     |

**Emits**

- `inc_upd` — emitted with `(incentive_id, rewarder, new_reward_points, new_total_budget)`. See [inc_upd](#inc_upd).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account MFR_SECRET \
  --fn update_incentive \
  -- --incentive_id 1 --new_reward_points 75 --new_total_budget 20000
```

---

### `update_incentive_status`

> **Role restriction:** None specified — any caller may toggle status (admin-level control recommended via contract governance).

**Signature**

```rust
pub fn update_incentive_status(env: Env, incentive_id: u64, is_active: bool) -> Incentive
```

**Parameters**

| Parameter      | Type   | Description                                |
| -------------- | ------ | ------------------------------------------ |
| `incentive_id` | `u64`  | ID of the incentive to update.             |
| `is_active`    | `bool` | `true` to activate; `false` to deactivate. |

**Returns**

The updated [`Incentive`](#incentive) with the new `active` status.

**Errors / Panics**

| Condition                | Error / Panic                  |
| ------------------------ | ------------------------------ |
| `incentive_id` not found | Panics `"Incentive not found"` |
| Contract is paused       | Panics `"Contract is paused"`  |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn update_incentive_status \
  -- --incentive_id 1 --is_active false
```

---

### `deactivate_incentive`

> **Role restriction:** The original `rewarder` (incentive creator). Must be registered and must sign.

**Signature**

```rust
pub fn deactivate_incentive(env: Env, incentive_id: u64, rewarder: Address) -> Incentive
```

**Parameters**

| Parameter      | Type      | Description                                                   |
| -------------- | --------- | ------------------------------------------------------------- |
| `incentive_id` | `u64`     | ID of the incentive to deactivate.                            |
| `rewarder`     | `Address` | Original creator of the incentive. Must sign the transaction. |

**Returns**

The updated [`Incentive`](#incentive) with `active = false`.

**Errors / Panics**

| Condition                              | Error / Panic                                     |
| -------------------------------------- | ------------------------------------------------- |
| `incentive_id` not found               | Panics `"Incentive not found"`                    |
| `rewarder` is not the original creator | Panics `"Only incentive creator can deactivate"`  |
| `rewarder` is not registered           | Panics `"Caller is not a registered participant"` |
| Contract is paused                     | Panics `"Contract is paused"`                     |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account MFR_SECRET \
  --fn deactivate_incentive \
  -- --incentive_id 1 --rewarder GMANUFACTURER_ADDRESS
```

---

### `get_incentive_by_id`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_incentive_by_id(env: Env, incentive_id: u64) -> Option<Incentive>
```

**Parameters**

| Parameter      | Type  | Description                      |
| -------------- | ----- | -------------------------------- |
| `incentive_id` | `u64` | ID of the incentive to retrieve. |

**Returns**

`Some(`[`Incentive`](#incentive)`)` if found; `None` otherwise.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_incentive_by_id \
  -- --incentive_id 1
```

---

### `get_incentives`

> **Role restriction:** None — read-only. Alias for [`get_incentives_by_waste_type`](#get_incentives_by_waste_type).

**Signature**

```rust
pub fn get_incentives(env: Env, waste_type: WasteType) -> Vec<Incentive>
```

**Parameters**

| Parameter    | Type        | Description                                           |
| ------------ | ----------- | ----------------------------------------------------- |
| `waste_type` | `WasteType` | Waste type to filter by. See [WasteType](#wastetype). |

**Returns**

Active `Vec<`[`Incentive`](#incentive)`>` for the given waste type, sorted by `reward_points` descending.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_incentives \
  -- --waste_type '{"Metal": null}'
```

---

### `get_incentives_by_waste_type`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_incentives_by_waste_type(env: Env, waste_type: WasteType) -> Vec<Incentive>
```

**Parameters**

| Parameter    | Type        | Description                                           |
| ------------ | ----------- | ----------------------------------------------------- |
| `waste_type` | `WasteType` | Waste type to filter by. See [WasteType](#wastetype). |

**Returns**

Active `Vec<`[`Incentive`](#incentive)`>` for the given waste type, sorted by `reward_points` descending. Returns an empty vector if no active incentives exist for that type.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_incentives_by_waste_type \
  -- --waste_type '{"PetPlastic": null}'
```

---

### `get_incentives_by_rewarder`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_incentives_by_rewarder(env: Env, rewarder: Address) -> Vec<Incentive>
```

**Parameters**

| Parameter  | Type      | Description                                        |
| ---------- | --------- | -------------------------------------------------- |
| `rewarder` | `Address` | Manufacturer address whose incentives to retrieve. |

**Returns**

`Vec<`[`Incentive`](#incentive)`>` of all incentives created by `rewarder`, in insertion order. Returns an empty vector if the rewarder has no incentives.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_incentives_by_rewarder \
  -- --rewarder GMANUFACTURER_ADDRESS
```

---

### `get_active_incentives`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_active_incentives(env: Env) -> Vec<Incentive>
```

**Parameters**

None.

**Returns**

`Vec<`[`Incentive`](#incentive)`>` of all currently active incentives across all waste types, in insertion order.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_active_incentives
```

---

### `get_active_mfr_incentive`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_active_mfr_incentive(
    env: Env,
    manufacturer: Address,
    waste_type: WasteType,
) -> Option<Incentive>
```

**Parameters**

| Parameter      | Type        | Description                                           |
| -------------- | ----------- | ----------------------------------------------------- |
| `manufacturer` | `Address`   | Manufacturer address to query.                        |
| `waste_type`   | `WasteType` | Waste type to filter by. See [WasteType](#wastetype). |

**Returns**

`Some(`[`Incentive`](#incentive)`)` with the highest `reward_points` among the manufacturer's active incentives for the given waste type; `None` if no matching active incentive exists.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_active_mfr_incentive \
  -- --manufacturer GMANUFACTURER_ADDRESS --waste_type '{"Glass": null}'
```

---

### `incentive_exists`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn incentive_exists(env: Env, incentive_id: u64) -> bool
```

**Parameters**

| Parameter      | Type  | Description                   |
| -------------- | ----- | ----------------------------- |
| `incentive_id` | `u64` | ID of the incentive to check. |

**Returns**

`true` if a record exists in storage for `incentive_id`; `false` otherwise.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn incentive_exists \
  -- --incentive_id 1
```

---

### `calculate_incentive_reward`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn calculate_incentive_reward(
    env: Env,
    incentive_id: u64,
    waste_amount: u64,
) -> u64
```

**Parameters**

| Parameter      | Type  | Description                                                                       |
| -------------- | ----- | --------------------------------------------------------------------------------- |
| `incentive_id` | `u64` | ID of the incentive to use for calculation.                                       |
| `waste_amount` | `u64` | Waste weight in **grams**. Formula: `floor(waste_amount / 1000) * reward_points`. |

**Returns**

Token reward amount (`u64`). Returns `0` if the incentive is inactive or `waste_amount < 1000` g.

**Errors / Panics**

| Condition                | Error / Panic                  |
| ------------------------ | ------------------------------ |
| `incentive_id` not found | Panics `"Incentive not found"` |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn calculate_incentive_reward \
  -- --incentive_id 1 --waste_amount 5000
# Returns: 250 (for reward_points=50: floor(5000/1000)*50)
```

---

### `claim_incentive_reward`

> **Role restriction:** Registered participant. `claimer` must sign the transaction.

**Signature**

```rust
pub fn claim_incentive_reward(
    env: Env,
    incentive_id: u64,
    material_id: u64,
    claimer: Address,
) -> Result<i128, Error>
```

**Parameters**

| Parameter      | Type      | Description                                                                                  |
| -------------- | --------- | -------------------------------------------------------------------------------------------- |
| `incentive_id` | `u64`     | ID of the incentive to claim from.                                                           |
| `material_id`  | `u64`     | ID of the verified v1 material being claimed for. Must be verified and match the waste type. |
| `claimer`      | `Address` | Registered participant claiming the reward. Must sign the transaction.                       |

**Returns**

`Ok(i128)` — the reward amount credited to `claimer.total_tokens_earned`. Returns `Err(Error::InsufficientBudget)` if the reward exceeds `remaining_budget`.

**Errors / Panics**

| Condition                                  | Error / Panic                                     |
| ------------------------------------------ | ------------------------------------------------- |
| `incentive_id` not found                   | Panics `"Incentive not found"`                    |
| Incentive is not active                    | Panics `"Incentive is not active"`                |
| `material_id` not found                    | Panics `"Material not found"`                     |
| Material is not verified                   | Panics `"Material not verified"`                  |
| Material waste type ≠ incentive waste type | Panics `"Waste type mismatch"`                    |
| Calculated reward is 0                     | Panics `"No reward available"`                    |
| Reward > `remaining_budget`                | `Err(Error::InsufficientBudget)` (code 31)        |
| `claimer` is not registered                | Panics `"Caller is not a registered participant"` |
| Contract is paused                         | Panics `"Contract is paused"`                     |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ALICE_SECRET \
  --fn claim_incentive_reward \
  -- --incentive_id 1 --material_id 5 --claimer GALICE_ADDRESS
```

---

## Rewards & Tokens

Functions for configuring the token contract, setting reward percentages, and distributing tokens to participants.

> **See also:** [Reward Distribution](#reward-distribution) for the full formula and default values.

---

### `set_token_address`

> **Role restriction:** Admin only. `admin` must sign the transaction.

**Signature**

```rust
pub fn set_token_address(env: Env, admin: Address, token_address: Address)
```

**Parameters**

| Parameter       | Type      | Description                                                     |
| --------------- | --------- | --------------------------------------------------------------- |
| `admin`         | `Address` | Contract admin. Must sign the transaction.                      |
| `token_address` | `Address` | Address of the SEP-41 token contract used for reward transfers. |

**Returns**

`()` — no return value.

**Errors / Panics**

| Condition                        | Error / Panic                               |
| -------------------------------- | ------------------------------------------- |
| `admin` is not in the admin list | Panics `"Caller is not the contract admin"` |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ADMIN_SECRET \
  --fn set_token_address \
  -- --admin GADMIN_ADDRESS --token_address GTOKEN_CONTRACT_ADDRESS
```

---

### `get_token_address`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_token_address(env: Env) -> Option<Address>
```

**Parameters**

None.

**Returns**

`Some(Address)` if a token contract has been configured via `set_token_address`; `None` otherwise.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_token_address
```

---

### `reward_tokens`

> **Role restriction:** Any registered caller. `rewarder` must sign the transaction.

**Signature**

```rust
pub fn reward_tokens(
    env: Env,
    rewarder: Address,
    recipient: Address,
    amount: i128,
    waste_id: u64,
)
```

**Parameters**

| Parameter   | Type      | Description                                                           |
| ----------- | --------- | --------------------------------------------------------------------- |
| `rewarder`  | `Address` | Caller authorising the reward. Must sign the transaction.             |
| `recipient` | `Address` | Registered participant receiving the tokens.                          |
| `amount`    | `i128`    | Token amount to reward. Must be > 0.                                  |
| `waste_id`  | `u64`     | Associated v1 waste record ID (used in the emitted `rewarded` event). |

**Returns**

`()` — no return value. On success, `recipient.total_tokens_earned` is incremented by `amount`.

**Errors / Panics**

| Condition                     | Error / Panic                                      |
| ----------------------------- | -------------------------------------------------- |
| `amount` ≤ 0                  | Panics `"Reward amount must be greater than zero"` |
| `recipient` is not registered | Panics `"Recipient not registered"`                |
| Token address not configured  | Panics `"Token address not set"`                   |
| Contract is paused            | Panics `"Contract is paused"`                      |

**Emits**

- `rewarded` — emitted with `(recipient, amount, waste_id)`. See [rewarded](#rewarded).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account REWARDER_SECRET \
  --fn reward_tokens \
  -- --rewarder GREWARDER_ADDRESS \
     --recipient GALICE_ADDRESS \
     --amount 100 \
     --waste_id 1
```

---

### `set_percentages`

> **Role restriction:** Admin only. `admin` must sign the transaction.

**Signature**

```rust
pub fn set_percentages(
    env: Env,
    admin: Address,
    collector_percentage: u32,
    owner_percentage: u32,
)
```

**Parameters**

| Parameter              | Type      | Description                                                                        |
| ---------------------- | --------- | ---------------------------------------------------------------------------------- |
| `admin`                | `Address` | Contract admin. Must sign the transaction.                                         |
| `collector_percentage` | `u32`     | New collector share (0–100). Combined with `owner_percentage` must not exceed 100. |
| `owner_percentage`     | `u32`     | New owner share (0–100). Combined with `collector_percentage` must not exceed 100. |

**Returns**

`()` — no return value. Both percentages are updated atomically.

**Errors / Panics**

| Condition                                       | Error / Panic                                  |
| ----------------------------------------------- | ---------------------------------------------- |
| `collector_percentage + owner_percentage > 100` | Panics `"Total percentages cannot exceed 100"` |
| `admin` is not in the admin list                | Panics `"Caller is not the contract admin"`    |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ADMIN_SECRET \
  --fn set_percentages \
  -- --admin GADMIN_ADDRESS --collector_percentage 10 --owner_percentage 60
```

**Edge case — sum exceeds 100:**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn set_percentages \
  -- --admin GADMIN_ADDRESS --collector_percentage 60 --owner_percentage 60
# Panics: "Total percentages cannot exceed 100"
```

---

### `get_collector_percentage`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_collector_percentage(env: Env) -> Option<u32>
```

**Parameters**

None.

**Returns**

`Some(u32)` — always returns a value. Defaults to `5` if `set_percentages` has never been called.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_collector_percentage
```

---

### `get_owner_percentage`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_owner_percentage(env: Env) -> Option<u32>
```

**Parameters**

None.

**Returns**

`Some(u32)` — always returns a value. Defaults to `50` if `set_percentages` has never been called.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_owner_percentage
```

---

### `set_collector_percentage`

> **Role restriction:** Admin only. `admin` must sign the transaction.

**Signature**

```rust
pub fn set_collector_percentage(env: Env, admin: Address, new_percentage: u32)
```

**Parameters**

| Parameter        | Type      | Description                                                                                  |
| ---------------- | --------- | -------------------------------------------------------------------------------------------- |
| `admin`          | `Address` | Contract admin. Must sign the transaction.                                                   |
| `new_percentage` | `u32`     | New collector share (0–100). Must satisfy `new_percentage + current_owner_percentage ≤ 100`. |

**Returns**

`()` — no return value. Only `collector_percentage` is updated; `owner_percentage` is preserved.

**Errors / Panics**

| Condition                                 | Error / Panic                                  |
| ----------------------------------------- | ---------------------------------------------- |
| `new_percentage + owner_percentage > 100` | Panics `"Total percentages cannot exceed 100"` |
| `admin` is not in the admin list          | Panics `"Caller is not the contract admin"`    |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ADMIN_SECRET \
  --fn set_collector_percentage \
  -- --admin GADMIN_ADDRESS --new_percentage 10
```

---

### `set_owner_percentage`

> **Role restriction:** Admin only. `admin` must sign the transaction.

**Signature**

```rust
pub fn set_owner_percentage(env: Env, admin: Address, new_percentage: u32)
```

**Parameters**

| Parameter        | Type      | Description                                                                                  |
| ---------------- | --------- | -------------------------------------------------------------------------------------------- |
| `admin`          | `Address` | Contract admin. Must sign the transaction.                                                   |
| `new_percentage` | `u32`     | New owner share (0–100). Must satisfy `current_collector_percentage + new_percentage ≤ 100`. |

**Returns**

`()` — no return value. Only `owner_percentage` is updated; `collector_percentage` is preserved.

**Errors / Panics**

| Condition                                     | Error / Panic                                  |
| --------------------------------------------- | ---------------------------------------------- |
| `collector_percentage + new_percentage > 100` | Panics `"Total percentages cannot exceed 100"` |
| `admin` is not in the admin list              | Panics `"Caller is not the contract admin"`    |

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ADMIN_SECRET \
  --fn set_owner_percentage \
  -- --admin GADMIN_ADDRESS --new_percentage 45
```

---

### `distribute_rewards`

> **Role restriction:** The incentive creator (`manufacturer`). Must sign the transaction.

**Signature**

```rust
pub fn distribute_rewards(
    env: Env,
    waste_id: u64,
    incentive_id: u64,
    manufacturer: Address,
) -> i128
```

**Parameters**

| Parameter      | Type      | Description                                               |
| -------------- | --------- | --------------------------------------------------------- |
| `waste_id`     | `u64`     | ID of the verified v1 material to distribute rewards for. |
| `incentive_id` | `u64`     | ID of the active incentive funding the distribution.      |
| `manufacturer` | `Address` | Original incentive creator. Must sign the transaction.    |

**Returns**

`i128` — total tokens distributed across all recipients (collectors, owner, recycler).

**Errors / Panics**

| Condition                                   | Error / Panic                                            |
| ------------------------------------------- | -------------------------------------------------------- |
| `waste_id` not found                        | Panics `"Material not found"`                            |
| Material is not verified                    | Panics `"Material must be confirmed"`                    |
| `incentive_id` not found                    | Panics `"Incentive not found"`                           |
| `manufacturer` is not the incentive creator | Panics `"Only incentive creator can distribute rewards"` |
| Waste type mismatch                         | Panics `"Waste type mismatch"`                           |
| Incentive is not active                     | Panics `"Incentive not active"`                          |
| Reward exceeds `remaining_budget`           | Panics `"Insufficient incentive budget"`                 |
| Token address not configured                | Panics `"Token address not set"`                         |
| Contract is paused                          | Panics `"Contract is paused"`                            |

**Emits**

- `rewarded` — one event per reward recipient (collectors in transfer history, submitter/owner, recycler remainder). See [rewarded](#rewarded).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account MFR_SECRET \
  --fn distribute_rewards \
  -- --waste_id 1 --incentive_id 1 --manufacturer GMANUFACTURER_ADDRESS
```

---

## Statistics & Queries

Read-only functions for querying per-participant recycling stats and contract-wide metrics.

---

### `get_stats`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_stats(env: Env, participant: Address) -> Option<RecyclingStats>
```

**Parameters**

| Parameter     | Type      | Description                                                 |
| ------------- | --------- | ----------------------------------------------------------- |
| `participant` | `Address` | Stellar address of the participant whose stats to retrieve. |

**Returns**

`Some(`[`RecyclingStats`](#recyclingstats)`)` if the participant has submitted or verified at least one material; `None` if no stats record exists yet.

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_stats \
  -- --participant GALICE_ADDRESS
```

---

### `get_supply_chain_stats`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_supply_chain_stats(env: Env) -> (u64, u64, u128)
```

**Parameters**

None.

**Returns**

A tuple `(total_wastes, total_weight_grams, total_tokens)`:

| Position | Type   | Semantic meaning                                                                                             |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| 0        | `u64`  | Total number of waste items logged in the system (v1 + v2 combined count).                                   |
| 1        | `u64`  | Total active waste weight in grams across all v2 records. May be expensive for large datasets (linear scan). |
| 2        | `u128` | Total tokens earned across all participants.                                                                 |

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_supply_chain_stats
# Returns: (1042, 5280000, 98500)
```

---

### `get_metrics`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn get_metrics(env: Env) -> GlobalMetrics
```

**Parameters**

None.

**Returns**

A [`GlobalMetrics`](#globalmetrics) struct:

| Field                 | Type   | Semantic meaning                                  |
| --------------------- | ------ | ------------------------------------------------- |
| `total_wastes_count`  | `u64`  | Total number of waste items logged in the system. |
| `total_tokens_earned` | `u128` | Total tokens earned across all participants.      |

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn get_metrics
```

---

## Contract Control

Functions for pausing and unpausing the contract. While paused, all state-changing functions revert.

---

### `pause`

> **Role restriction:** Admin only. `admin` must sign the transaction.

**Signature**

```rust
pub fn pause(env: Env, admin: Address)
```

**Parameters**

| Parameter | Type      | Description                                |
| --------- | --------- | ------------------------------------------ |
| `admin`   | `Address` | Contract admin. Must sign the transaction. |

**Returns**

`()` — no return value. After this call, all state-changing functions will revert with `"Contract is paused"` until `unpause` is called.

**Errors / Panics**

| Condition                        | Error / Panic                               |
| -------------------------------- | ------------------------------------------- |
| `admin` is not in the admin list | Panics `"Caller is not the contract admin"` |
| Contract is already paused       | Panics `"Contract is already paused"`       |

**Emits**

- `paused` — emitted with `admin` as the data payload. See [paused](#paused).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ADMIN_SECRET \
  --fn pause \
  -- --admin GADMIN_ADDRESS
```

---

### `unpause`

> **Role restriction:** Admin only. `admin` must sign the transaction.

**Signature**

```rust
pub fn unpause(env: Env, admin: Address)
```

**Parameters**

| Parameter | Type      | Description                                |
| --------- | --------- | ------------------------------------------ |
| `admin`   | `Address` | Contract admin. Must sign the transaction. |

**Returns**

`()` — no return value. After this call, all state-changing functions resume normal operation.

**Errors / Panics**

| Condition                        | Error / Panic                               |
| -------------------------------- | ------------------------------------------- |
| `admin` is not in the admin list | Panics `"Caller is not the contract admin"` |
| Contract is not currently paused | Panics `"Contract is not paused"`           |

**Emits**

- `unpaused` — emitted with `admin` as the data payload. See [unpaused](#unpaused).

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source-account ADMIN_SECRET \
  --fn unpause \
  -- --admin GADMIN_ADDRESS
```

---

### `is_paused`

> **Role restriction:** None — read-only.

**Signature**

```rust
pub fn is_paused(env: Env) -> bool
```

**Parameters**

None.

**Returns**

`true` if the contract is currently paused; `false` otherwise (including if `pause` has never been called).

**Errors / Panics**

None.

**Example**

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --fn is_paused
```

---
