#![cfg(test)]

use crate::types::{ParticipantRole, WasteType};
use crate::{ScavengerContract, ScavengerContractClient};
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, Error};

// ─── helpers ────────────────────────────────────────────────────────────────

fn setup() -> (Env, ScavengerContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract {});
    let client = ScavengerContractClient::new(&env, &contract_id);
    (env, client)
}

fn register(client: &ScavengerContractClient, env: &Env, role: ParticipantRole) -> Address {
    let addr = Address::generate(env);
    client.register_participant(&addr, &role, &symbol_short!("name"), &0, &0);
    addr
}

/// Create waste owned by a Recycler (the only role that can call recycle_waste).
fn create_waste(client: &ScavengerContractClient, recycler: &Address) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &1000, recycler, &0, &0)
}

// ─── Unit tests: valid routes ────────────────────────────────────────────────

#[test]
fn test_recycler_to_collector_is_valid() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    assert!(client.is_valid_transfer(&recycler, &collector));
}

#[test]
fn test_recycler_to_collector_transfer_succeeds_and_updates_owner() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    let waste_id = create_waste(&client, &recycler);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, collector);
}

#[test]
fn test_recycler_to_manufacturer_is_valid() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);
    assert!(client.is_valid_transfer(&recycler, &manufacturer));
}

#[test]
fn test_recycler_to_manufacturer_transfer_succeeds_and_updates_owner() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);
    let waste_id = create_waste(&client, &recycler);
    client.transfer_waste_v2(&waste_id, &recycler, &manufacturer, &0, &0);
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, manufacturer);
}

#[test]
fn test_collector_to_manufacturer_is_valid() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);
    assert!(client.is_valid_transfer(&collector, &manufacturer));
    // Also verify transfer works: recycler→collector first, then collector→manufacturer
    let waste_id = create_waste(&client, &recycler);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    client.transfer_waste_v2(&waste_id, &collector, &manufacturer, &0, &0);
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, manufacturer);
}

// ─── Unit tests: invalid routes ─────────────────────────────────────────────

#[test]
fn test_recycler_to_recycler_is_invalid() {
    let (env, client) = setup();
    let r1 = register(&client, &env, ParticipantRole::Recycler);
    let r2 = register(&client, &env, ParticipantRole::Recycler);
    assert!(!client.is_valid_transfer(&r1, &r2));
}

#[test]
fn test_recycler_to_recycler_transfer_fails_and_state_unchanged() {
    let (env, client) = setup();
    let r1 = register(&client, &env, ParticipantRole::Recycler);
    let r2 = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &r1);
    let result = client.try_transfer_waste_v2(&waste_id, &r1, &r2, &0, &0);
    assert!(result.is_err());
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, r1);
}

#[test]
fn test_collector_to_recycler_is_invalid() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    assert!(!client.is_valid_transfer(&collector, &recycler));
}

#[test]
fn test_collector_to_recycler_transfer_fails_and_state_unchanged() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    // Get waste to collector via valid route first
    let waste_id = create_waste(&client, &recycler);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    // Now attempt invalid: collector → recycler
    let result = client.try_transfer_waste_v2(&waste_id, &collector, &recycler, &0, &0);
    assert!(result.is_err());
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, collector);
}

#[test]
fn test_collector_to_collector_is_invalid() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let c1 = register(&client, &env, ParticipantRole::Collector);
    let c2 = register(&client, &env, ParticipantRole::Collector);
    assert!(!client.is_valid_transfer(&c1, &c2));
    // Get waste to c1 via valid route
    let waste_id = create_waste(&client, &recycler);
    client.transfer_waste_v2(&waste_id, &recycler, &c1, &0, &0);
    // Attempt invalid: collector → collector
    let result = client.try_transfer_waste_v2(&waste_id, &c1, &c2, &0, &0);
    assert!(result.is_err());
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, c1);
}

#[test]
fn test_manufacturer_to_recycler_is_invalid() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);
    assert!(!client.is_valid_transfer(&manufacturer, &recycler));
}

#[test]
fn test_manufacturer_to_recycler_transfer_fails_and_state_unchanged() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);
    // Get waste to manufacturer via valid route
    let waste_id = create_waste(&client, &recycler);
    client.transfer_waste_v2(&waste_id, &recycler, &manufacturer, &0, &0);
    // Attempt invalid: manufacturer → recycler
    let result = client.try_transfer_waste_v2(&waste_id, &manufacturer, &recycler, &0, &0);
    assert!(result.is_err());
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, manufacturer);
}

#[test]
fn test_manufacturer_to_collector_is_invalid() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);
    assert!(!client.is_valid_transfer(&manufacturer, &collector));
    // Get waste to manufacturer via valid route
    let waste_id = create_waste(&client, &recycler);
    client.transfer_waste_v2(&waste_id, &recycler, &manufacturer, &0, &0);
    // Attempt invalid: manufacturer → collector
    let result = client.try_transfer_waste_v2(&waste_id, &manufacturer, &collector, &0, &0);
    assert!(result.is_err());
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, manufacturer);
}

#[test]
fn test_manufacturer_to_manufacturer_is_invalid() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let m1 = register(&client, &env, ParticipantRole::Manufacturer);
    let m2 = register(&client, &env, ParticipantRole::Manufacturer);
    assert!(!client.is_valid_transfer(&m1, &m2));
    // Get waste to m1 via valid route
    let waste_id = create_waste(&client, &recycler);
    client.transfer_waste_v2(&waste_id, &recycler, &m1, &0, &0);
    // Attempt invalid: manufacturer → manufacturer
    let result = client.try_transfer_waste_v2(&waste_id, &m1, &m2, &0, &0);
    assert!(result.is_err());
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.current_owner, m1);
}

// ─── Property 1: Valid routes return true ───────────────────────────────────
// Validates: Requirements 1.1, 1.2, 2.1, 4.4

#[test]
fn prop1_valid_routes_return_true() {
    let valid_pairs: &[(ParticipantRole, ParticipantRole)] = &[
        (ParticipantRole::Recycler, ParticipantRole::Collector),
        (ParticipantRole::Recycler, ParticipantRole::Manufacturer),
        (ParticipantRole::Collector, ParticipantRole::Manufacturer),
    ];

    for (from_role, to_role) in valid_pairs {
        let (env, client) = setup();
        let from = register(&client, &env, *from_role);
        let to = register(&client, &env, *to_role);
        assert!(
            client.is_valid_transfer(&from, &to),
            "Expected is_valid_transfer to return true for {:?} → {:?}",
            from_role,
            to_role
        );
    }
}

// ─── Property 2: Invalid routes return false ────────────────────────────────
// Validates: Requirements 1.3, 2.2, 2.3, 3.1, 3.3, 3.4, 3.5, 4.5

#[test]
fn prop2_invalid_routes_return_false() {
    let invalid_pairs: &[(ParticipantRole, ParticipantRole)] = &[
        (ParticipantRole::Recycler, ParticipantRole::Recycler),
        (ParticipantRole::Collector, ParticipantRole::Recycler),
        (ParticipantRole::Collector, ParticipantRole::Collector),
        (ParticipantRole::Manufacturer, ParticipantRole::Recycler),
        (ParticipantRole::Manufacturer, ParticipantRole::Collector),
        (ParticipantRole::Manufacturer, ParticipantRole::Manufacturer),
    ];

    for (from_role, to_role) in invalid_pairs {
        let (env, client) = setup();
        let from = register(&client, &env, *from_role);
        let to = register(&client, &env, *to_role);
        assert!(
            !client.is_valid_transfer(&from, &to),
            "Expected is_valid_transfer to return false for {:?} → {:?}",
            from_role,
            to_role
        );
    }
}

// ─── Property 3: Unregistered participants cause false ──────────────────────
// Validates: Requirements 4.2, 4.3

#[test]
fn prop3_unregistered_from_returns_false() {
    let (env, client) = setup();
    let unregistered = Address::generate(&env);
    let collector = register(&client, &env, ParticipantRole::Collector);
    assert!(!client.is_valid_transfer(&unregistered, &collector));
}

#[test]
fn prop3_unregistered_to_returns_false() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let unregistered = Address::generate(&env);
    assert!(!client.is_valid_transfer(&recycler, &unregistered));
}

#[test]
fn prop3_both_unregistered_returns_false() {
    let (env, client) = setup();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    assert!(!client.is_valid_transfer(&a, &b));
}

#[test]
fn prop3_deregistered_from_returns_false() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    // Deregister the sender
    client.deregister_participant(&recycler);
    assert!(!client.is_valid_transfer(&recycler, &collector));
}

#[test]
fn prop3_deregistered_to_returns_false() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    // Deregister the recipient
    client.deregister_participant(&collector);
    assert!(!client.is_valid_transfer(&recycler, &collector));
}

// ─── Property 4: Invalid route transfer leaves state unchanged ───────────────
// Validates: Requirements 1.4, 2.4, 3.2, 5.1

#[test]
fn prop4_invalid_route_transfer_leaves_state_unchanged() {
    // For each invalid pair, verify that after a failed transfer the owner is unchanged.
    // We need waste owned by the sender for each case.
    // Pairs where sender is Recycler: just recycle_waste directly.
    // Pairs where sender is Collector or Manufacturer: chain valid transfers first.

    // (Recycler → Recycler)
    {
        let (env, client) = setup();
        let r1 = register(&client, &env, ParticipantRole::Recycler);
        let r2 = register(&client, &env, ParticipantRole::Recycler);
        let waste_id = create_waste(&client, &r1);
        let result = client.try_transfer_waste_v2(&waste_id, &r1, &r2, &0, &0);
        assert!(result.is_err());
        assert_eq!(client.get_waste_v2(&waste_id).unwrap().current_owner, r1);
    }

    // (Collector → Recycler)
    {
        let (env, client) = setup();
        let recycler = register(&client, &env, ParticipantRole::Recycler);
        let collector = register(&client, &env, ParticipantRole::Collector);
        let waste_id = create_waste(&client, &recycler);
        client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
        let result = client.try_transfer_waste_v2(&waste_id, &collector, &recycler, &0, &0);
        assert!(result.is_err());
        assert_eq!(client.get_waste_v2(&waste_id).unwrap().current_owner, collector);
    }

    // (Collector → Collector)
    {
        let (env, client) = setup();
        let recycler = register(&client, &env, ParticipantRole::Recycler);
        let c1 = register(&client, &env, ParticipantRole::Collector);
        let c2 = register(&client, &env, ParticipantRole::Collector);
        let waste_id = create_waste(&client, &recycler);
        client.transfer_waste_v2(&waste_id, &recycler, &c1, &0, &0);
        let result = client.try_transfer_waste_v2(&waste_id, &c1, &c2, &0, &0);
        assert!(result.is_err());
        assert_eq!(client.get_waste_v2(&waste_id).unwrap().current_owner, c1);
    }

    // (Manufacturer → Recycler)
    {
        let (env, client) = setup();
        let recycler = register(&client, &env, ParticipantRole::Recycler);
        let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);
        let waste_id = create_waste(&client, &recycler);
        client.transfer_waste_v2(&waste_id, &recycler, &manufacturer, &0, &0);
        let result = client.try_transfer_waste_v2(&waste_id, &manufacturer, &recycler, &0, &0);
        assert!(result.is_err());
        assert_eq!(client.get_waste_v2(&waste_id).unwrap().current_owner, manufacturer);
    }

    // (Manufacturer → Collector)
    {
        let (env, client) = setup();
        let recycler = register(&client, &env, ParticipantRole::Recycler);
        let collector = register(&client, &env, ParticipantRole::Collector);
        let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);
        let waste_id = create_waste(&client, &recycler);
        client.transfer_waste_v2(&waste_id, &recycler, &manufacturer, &0, &0);
        let result = client.try_transfer_waste_v2(&waste_id, &manufacturer, &collector, &0, &0);
        assert!(result.is_err());
        assert_eq!(client.get_waste_v2(&waste_id).unwrap().current_owner, manufacturer);
    }

    // (Manufacturer → Manufacturer)
    {
        let (env, client) = setup();
        let recycler = register(&client, &env, ParticipantRole::Recycler);
        let m1 = register(&client, &env, ParticipantRole::Manufacturer);
        let m2 = register(&client, &env, ParticipantRole::Manufacturer);
        let waste_id = create_waste(&client, &recycler);
        client.transfer_waste_v2(&waste_id, &recycler, &m1, &0, &0);
        let result = client.try_transfer_waste_v2(&waste_id, &m1, &m2, &0, &0);
        assert!(result.is_err());
        assert_eq!(client.get_waste_v2(&waste_id).unwrap().current_owner, m1);
    }
}

// ─── Property 5: Valid route transfer ownership round-trip ──────────────────
// Validates: Requirements 5.2, 5.4

#[test]
fn prop5_valid_route_transfer_ownership_round_trip() {
    // (Recycler → Collector)
    {
        let (env, client) = setup();
        let recycler = register(&client, &env, ParticipantRole::Recycler);
        let collector = register(&client, &env, ParticipantRole::Collector);
        let waste_id = create_waste(&client, &recycler);
        client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
        let waste = client.get_waste_v2(&waste_id).unwrap();
        assert_eq!(waste.current_owner, collector);
    }

    // (Recycler → Manufacturer)
    {
        let (env, client) = setup();
        let recycler = register(&client, &env, ParticipantRole::Recycler);
        let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);
        let waste_id = create_waste(&client, &recycler);
        client.transfer_waste_v2(&waste_id, &recycler, &manufacturer, &0, &0);
        let waste = client.get_waste_v2(&waste_id).unwrap();
        assert_eq!(waste.current_owner, manufacturer);
    }

    // (Collector → Manufacturer)
    {
        let (env, client) = setup();
        let recycler = register(&client, &env, ParticipantRole::Recycler);
        let collector = register(&client, &env, ParticipantRole::Collector);
        let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);
        let waste_id = create_waste(&client, &recycler);
        client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
        client.transfer_waste_v2(&waste_id, &collector, &manufacturer, &0, &0);
        let waste = client.get_waste_v2(&waste_id).unwrap();
        assert_eq!(waste.current_owner, manufacturer);
    }
}

// ─── Task 4: Unregistered-participant tests ──────────────────────────────────
// Validates: Requirements 4.2, 4.3, 6.5

#[test]
fn test_unregistered_from_not_in_storage() {
    let (env, client) = setup();
    let unknown = Address::generate(&env);
    let collector = register(&client, &env, ParticipantRole::Collector);
    assert!(!client.is_valid_transfer(&unknown, &collector));
}

#[test]
fn test_unregistered_to_not_in_storage() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let unknown = Address::generate(&env);
    assert!(!client.is_valid_transfer(&recycler, &unknown));
}

#[test]
fn test_both_unregistered_not_in_storage() {
    let (env, client) = setup();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    assert!(!client.is_valid_transfer(&a, &b));
}

#[test]
fn test_deregistered_from_is_registered_false() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    client.deregister_participant(&recycler);
    assert!(!client.is_valid_transfer(&recycler, &collector));
}

#[test]
fn test_deregistered_to_is_registered_false() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    client.deregister_participant(&collector);
    assert!(!client.is_valid_transfer(&recycler, &collector));
}

#[test]
fn test_deregistered_both_is_registered_false() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    client.deregister_participant(&recycler);
    client.deregister_participant(&collector);
    assert!(!client.is_valid_transfer(&recycler, &collector));
}
