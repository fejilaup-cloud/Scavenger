#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ScavengerContract, ScavengerContractClient};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    let id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &id);
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    (client, admin)
}

// ── 1. Default multiplier is 100 (1x) when nothing is set ──────────────────
#[test]
fn test_default_multiplier_is_100() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    assert_eq!(client.get_current_multiplier(), 100);
}

// ── 2. Admin can set a valid multiplier ────────────────────────────────────
#[test]
fn test_set_seasonal_multiplier_success() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let now = env.ledger().timestamp();
    client.set_seasonal_multiplier(&admin, &150, &now, &(now + 1000));

    assert_eq!(client.get_current_multiplier(), 150);
}

// ── 3. Multiplier of 500 (5x max) is accepted ─────────────────────────────
#[test]
fn test_max_multiplier_500_accepted() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let now = env.ledger().timestamp();
    client.set_seasonal_multiplier(&admin, &500, &now, &(now + 100));

    assert_eq!(client.get_current_multiplier(), 500);
}

// ── 4. Multiplier above 500 is rejected ───────────────────────────────────
#[test]
#[should_panic(expected = "Multiplier must be between 100 and 500 basis points")]
fn test_multiplier_above_500_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let now = env.ledger().timestamp();
    client.set_seasonal_multiplier(&admin, &501, &now, &(now + 100));
}

// ── 5. Multiplier below 100 is rejected ───────────────────────────────────
#[test]
#[should_panic(expected = "Multiplier must be between 100 and 500 basis points")]
fn test_multiplier_below_100_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let now = env.ledger().timestamp();
    client.set_seasonal_multiplier(&admin, &99, &now, &(now + 100));
}

// ── 6. start >= end is rejected ───────────────────────────────────────────
#[test]
#[should_panic(expected = "start must be before end")]
fn test_invalid_time_range_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    let now = env.ledger().timestamp();
    client.set_seasonal_multiplier(&admin, &150, &(now + 100), &now);
}

// ── 7. Non-admin cannot set multiplier ────────────────────────────────────
#[test]
#[should_panic(expected = "Unauthorized")]
fn test_non_admin_cannot_set_multiplier() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);

    let now = env.ledger().timestamp();
    client.set_seasonal_multiplier(&non_admin, &150, &now, &(now + 1000));
}

// ── 8. Expired multiplier falls back to 100 ───────────────────────────────
#[test]
fn test_expired_multiplier_returns_100() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    // Set a multiplier that has already expired (end in the past)
    // Ledger timestamp starts at 0 in tests; set start/end both in the past
    // by advancing the ledger after setting.
    client.set_seasonal_multiplier(&admin, &200, &1, &50);

    // Advance ledger past the end timestamp
    env.ledger().with_mut(|l| l.timestamp = 100);

    assert_eq!(client.get_current_multiplier(), 100);
}

// ── 9. Multiplier not yet started returns 100 ─────────────────────────────
#[test]
fn test_future_multiplier_returns_100() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin) = setup(&env);

    // Current ledger timestamp is 0; set multiplier to start in the future
    client.set_seasonal_multiplier(&admin, &200, &1000, &2000);

    assert_eq!(client.get_current_multiplier(), 100);
}
