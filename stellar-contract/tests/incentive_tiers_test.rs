#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, Vec};
use stellar_scavngr_contract::{IncentiveTier, ScavengerContract, ScavengerContractClient, WasteType};

fn setup() -> (Env, ScavengerContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    client.register_participant(
        &manufacturer,
        &stellar_scavngr_contract::ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("mfr"),
        &0,
        &0,
    );

    (env, client, manufacturer)
}

fn make_tiers(env: &Env, specs: &[(u64, u64, u64)]) -> Vec<IncentiveTier> {
    let mut tiers = Vec::new(env);
    for &(min, max, pts) in specs {
        tiers.push_back(IncentiveTier {
            min_weight_kg: min,
            max_weight_kg: max,
            reward_points: pts,
        });
    }
    tiers
}

// ── 1. set_incentive_tiers stores tiers and they are retrievable ──────────────
#[test]
fn test_set_tiers_stored_correctly() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &100_000);

    let tiers = make_tiers(&env, &[(0, 100, 10), (100, 500, 15), (500, 0, 20)]);
    let updated = client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers);

    assert_eq!(updated.tiers.len(), 3);
    assert_eq!(updated.tiers.get(0).unwrap().reward_points, 10);
    assert_eq!(updated.tiers.get(1).unwrap().reward_points, 15);
    assert_eq!(updated.tiers.get(2).unwrap().reward_points, 20);
}

// ── 2. Reward uses first tier for weight in [0, 100) kg ──────────────────────
#[test]
fn test_reward_first_tier() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &5, &100_000);
    let tiers = make_tiers(&env, &[(0, 100, 10), (100, 500, 15), (500, 0, 20)]);
    client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers);

    // 50 kg → tier 1 → 50 * 10 = 500
    let reward = client.calculate_incentive_reward(&incentive.id, &50_000);
    assert_eq!(reward, 500);
}

// ── 3. Reward uses second tier for weight in [100, 500) kg ───────────────────
#[test]
fn test_reward_second_tier() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &5, &100_000);
    let tiers = make_tiers(&env, &[(0, 100, 10), (100, 500, 15), (500, 0, 20)]);
    client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers);

    // 200 kg → tier 2 → 200 * 15 = 3000
    let reward = client.calculate_incentive_reward(&incentive.id, &200_000);
    assert_eq!(reward, 3000);
}

// ── 4. Reward uses last (unbounded) tier for weight >= 500 kg ─────────────────
#[test]
fn test_reward_last_tier_unbounded() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &5, &100_000);
    let tiers = make_tiers(&env, &[(0, 100, 10), (100, 500, 15), (500, 0, 20)]);
    client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers);

    // 1000 kg → tier 3 → 1000 * 20 = 20000
    let reward = client.calculate_incentive_reward(&incentive.id, &1_000_000);
    assert_eq!(reward, 20000);
}

// ── 5. Flat rate still works when no tiers are set ───────────────────────────
#[test]
fn test_flat_rate_without_tiers() {
    let (_env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Metal, &10, &100_000);

    // 50 kg * 10 pts = 500
    let reward = client.calculate_incentive_reward(&incentive.id, &50_000);
    assert_eq!(reward, 500);
}

// ── 6. Validation: max 5 tiers ────────────────────────────────────────────────
#[test]
#[should_panic(expected = "Maximum 5 tiers allowed")]
fn test_max_5_tiers_enforced() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &100_000);
    // 6 tiers
    let tiers = make_tiers(
        &env,
        &[
            (0, 50, 5),
            (50, 100, 10),
            (100, 200, 15),
            (200, 300, 18),
            (300, 400, 20),
            (400, 0, 25),
        ],
    );
    client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers);
}

// ── 7. Validation: empty tiers rejected ──────────────────────────────────────
#[test]
#[should_panic(expected = "Tiers cannot be empty")]
fn test_empty_tiers_rejected() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &100_000);
    let tiers: Vec<IncentiveTier> = Vec::new(&env);
    client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers);
}

// ── 8. Validation: overlapping ranges rejected ───────────────────────────────
#[test]
#[should_panic]
fn test_overlapping_tiers_rejected() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &100_000);
    // Gap between tiers (min of second != max of first)
    let tiers = make_tiers(&env, &[(0, 100, 10), (50, 0, 20)]);
    client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers);
}

// ── 9. Validation: last tier must be unbounded ───────────────────────────────
#[test]
#[should_panic(expected = "Last tier must be unbounded (max_weight_kg == 0)")]
fn test_last_tier_must_be_unbounded() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &100_000);
    let tiers = make_tiers(&env, &[(0, 100, 10), (100, 500, 20)]);
    client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers);
}

// ── 10. Validation: only creator can set tiers ───────────────────────────────
#[test]
#[should_panic(expected = "Only incentive creator can set tiers")]
fn test_only_creator_can_set_tiers() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &100_000);

    // Register a second manufacturer
    let other = Address::generate(&env);
    client.register_participant(
        &other,
        &stellar_scavngr_contract::ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("other"),
        &0,
        &0,
    );

    let tiers = make_tiers(&env, &[(0, 0, 10)]);
    client.set_incentive_tiers(&incentive.id, &other, &tiers);
}

// ── 11. Validation: cannot set tiers on inactive incentive ───────────────────
#[test]
#[should_panic(expected = "Incentive is not active")]
fn test_cannot_set_tiers_on_inactive_incentive() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &100_000);
    client.deactivate_incentive(&incentive.id, &manufacturer);

    let tiers = make_tiers(&env, &[(0, 0, 10)]);
    client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers);
}

// ── 12. Validation: tier reward_points must be > 0 ───────────────────────────
#[test]
#[should_panic(expected = "Tier reward_points must be greater than zero")]
fn test_zero_reward_points_in_tier_rejected() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &100_000);
    let tiers = make_tiers(&env, &[(0, 100, 0), (100, 0, 10)]);
    client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers);
}

// ── 13. Single unbounded tier works ──────────────────────────────────────────
#[test]
fn test_single_unbounded_tier() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Glass, &5, &100_000);
    let tiers = make_tiers(&env, &[(0, 0, 25)]);
    client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers);

    // 10 kg * 25 = 250
    let reward = client.calculate_incentive_reward(&incentive.id, &10_000);
    assert_eq!(reward, 250);
}

// ── 14. Tiers can be updated (overwritten) ───────────────────────────────────
#[test]
fn test_tiers_can_be_overwritten() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Paper, &5, &100_000);

    let tiers_v1 = make_tiers(&env, &[(0, 0, 10)]);
    client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers_v1);

    let tiers_v2 = make_tiers(&env, &[(0, 100, 20), (100, 0, 30)]);
    let updated = client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers_v2);

    assert_eq!(updated.tiers.len(), 2);
    assert_eq!(updated.tiers.get(0).unwrap().reward_points, 20);
}

// ── 15. Boundary: weight exactly at tier boundary uses correct tier ───────────
#[test]
fn test_tier_boundary_exact() {
    let (env, client, manufacturer) = setup();
    let incentive = client.create_incentive(&manufacturer, &WasteType::Metal, &5, &100_000);
    // Tiers: [0,100) → 10pts, [100,∞) → 20pts
    let tiers = make_tiers(&env, &[(0, 100, 10), (100, 0, 20)]);
    client.set_incentive_tiers(&incentive.id, &manufacturer, &tiers);

    // Exactly 100 kg → second tier → 100 * 20 = 2000
    let reward = client.calculate_incentive_reward(&incentive.id, &100_000);
    assert_eq!(reward, 2000);

    // 99 kg → first tier → 99 * 10 = 990
    let reward2 = client.calculate_incentive_reward(&incentive.id, &99_000);
    assert_eq!(reward2, 990);
}
