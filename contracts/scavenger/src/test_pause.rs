#![cfg(test)]

use soroban_sdk::{testutils::{Address as _, Events}, Address, Env, IntoVal, String};

use crate::{ScavengerContract, ScavengerContractClient};
use crate::types::{Role, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address, Address, Address) {
    let contract_id = env.register(ScavengerContract, ());
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let token = env.register_stellar_asset_contract(admin.clone());
    let charity = Address::generate(env);
    env.mock_all_auths();
    client.initialize(&admin, &token, &charity, &10, &20);
    (client, admin, token, charity)
}

// ── pause / unpause access control ──────────────────────────────────────────

#[test]
fn test_only_admin_can_pause() {
    let env = Env::default();
    let (client, _admin, _, _) = setup(&env);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Only admin can perform this action")]
fn test_non_admin_cannot_pause() {
    let env = Env::default();
    let (client, _, _, _) = setup(&env);
    let non_admin = Address::generate(&env);
    client.pause(&non_admin);
}

#[test]
#[should_panic(expected = "Only admin can perform this action")]
fn test_non_admin_cannot_unpause() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.pause(&admin);
    let non_admin = Address::generate(&env);
    client.unpause(&non_admin);
}

// ── pause blocks state-changing functions ───────────────────────────────────

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_register_participant() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.pause(&admin);
    let user = Address::generate(&env);
    client.register_participant(&user, &Role::Recycler, &String::from_str(&env, "Alice"), &0, &0);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_submit_material() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    // Register before pausing
    let user = Address::generate(&env);
    client.register_participant(&user, &Role::Recycler, &String::from_str(&env, "Alice"), &0, &0);
    client.pause(&admin);
    client.submit_material(&user, &WasteType::Plastic, &5000);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_transfer_waste() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    client.register_participant(&recycler, &Role::Recycler, &String::from_str(&env, "R"), &0, &0);
    client.register_participant(&collector, &Role::Collector, &String::from_str(&env, "C"), &0, &0);
    let material = client.submit_material(&recycler, &WasteType::Plastic, &5000);
    client.pause(&admin);
    client.transfer_waste(&material.id, &recycler, &collector);
}

// ── unpause restores functionality ──────────────────────────────────────────

#[test]
fn test_unpause_restores_register_participant() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.pause(&admin);
    client.unpause(&admin);
    let user = Address::generate(&env);
    // Should not panic
    client.register_participant(&user, &Role::Recycler, &String::from_str(&env, "Alice"), &0, &0);
    assert!(client.is_participant_registered(&user));
}

#[test]
fn test_unpause_restores_submit_material() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.register_participant(&user, &Role::Recycler, &String::from_str(&env, "Alice"), &0, &0);
    client.pause(&admin);
    client.unpause(&admin);
    let material = client.submit_material(&user, &WasteType::Plastic, &5000);
    assert_eq!(material.weight, 5000);
}

// ── double pause / unpause guards ───────────────────────────────────────────

#[test]
#[should_panic(expected = "Contract is already paused")]
fn test_cannot_pause_when_already_paused() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.pause(&admin);
    client.pause(&admin);
}

#[test]
#[should_panic(expected = "Contract is not paused")]
fn test_cannot_unpause_when_not_paused() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.unpause(&admin);
}

// ── events ───────────────────────────────────────────────────────────────────

#[test]
fn test_pause_emits_event() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.pause(&admin);

    let events = env.events().all();
    let paused_event = events.iter().find(|(_, topics, _)| {
        topics == &soroban_sdk::vec![&env, soroban_sdk::symbol_short!("paused").into_val(&env)]
    });
    assert!(paused_event.is_some(), "paused event not emitted");
}

#[test]
fn test_unpause_emits_event() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.pause(&admin);
    client.unpause(&admin);

    let events = env.events().all();
    let unpaused_event = events.iter().find(|(_, topics, _)| {
        topics == &soroban_sdk::vec![&env, soroban_sdk::symbol_short!("unpaused").into_val(&env)]
    });
    assert!(unpaused_event.is_some(), "unpaused event not emitted");
}
