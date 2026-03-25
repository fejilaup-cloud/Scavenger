use soroban_sdk::{symbol_short, testutils::{Address as _, Events}, Address, Env, IntoVal, TryIntoVal};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient};

fn setup(env: &Env) -> (ScavengerContractClient, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let participant = Address::generate(env);
    env.mock_all_auths();
    client.register_participant(
        &participant,
        &ParticipantRole::Recycler,
        &symbol_short!("Alice"),
        &10_000_000,
        &20_000_000,
    );
    (client, participant)
}

#[test]
fn test_update_participant_location_success() {
    let env = Env::default();
    let (client, participant) = setup(&env);

    let updated = client.update_participant_location(&participant, &40_000_000, &-74_000_000);

    assert_eq!(updated.latitude, 40_000_000);
    assert_eq!(updated.longitude, -74_000_000);
}

#[test]
fn test_update_participant_location_persists() {
    let env = Env::default();
    let (client, participant) = setup(&env);

    client.update_participant_location(&participant, &51_500_000, &-127_000);

    let fetched = client.get_participant(&participant).unwrap();
    assert_eq!(fetched.latitude, 51_500_000);
    assert_eq!(fetched.longitude, -127_000);
}

#[test]
fn test_update_participant_location_emits_event() {
    let env = Env::default();
    let (client, participant) = setup(&env);

    client.update_participant_location(&participant, &35_000_000, &139_000_000);

    let events = env.events().all();
    let event = events.last().unwrap();

    let expected_topics: soroban_sdk::Vec<soroban_sdk::Val> =
        (symbol_short!("loc_upd"), participant.clone()).into_val(&env);
    assert_eq!(event.1, expected_topics);

    let data: (i128, i128) = event.2.try_into_val(&env).unwrap();
    assert_eq!(data.0, 35_000_000);
    assert_eq!(data.1, 139_000_000);
}

#[test]
fn test_update_participant_location_boundary_values() {
    let env = Env::default();
    let (client, participant) = setup(&env);

    // Max valid coordinates
    client.update_participant_location(&participant, &90_000_000, &180_000_000);
    let p = client.get_participant(&participant).unwrap();
    assert_eq!(p.latitude, 90_000_000);
    assert_eq!(p.longitude, 180_000_000);

    // Min valid coordinates
    client.update_participant_location(&participant, &-90_000_000, &-180_000_000);
    let p = client.get_participant(&participant).unwrap();
    assert_eq!(p.latitude, -90_000_000);
    assert_eq!(p.longitude, -180_000_000);
}

#[test]
#[should_panic(expected = "Latitude must be between -90 and +90 degrees")]
fn test_update_participant_location_invalid_latitude() {
    let env = Env::default();
    let (client, participant) = setup(&env);
    client.update_participant_location(&participant, &91_000_000, &0);
}

#[test]
#[should_panic(expected = "Longitude must be between -180 and +180 degrees")]
fn test_update_participant_location_invalid_longitude() {
    let env = Env::default();
    let (client, participant) = setup(&env);
    client.update_participant_location(&participant, &0, &181_000_000);
}

#[test]
#[should_panic]
fn test_update_participant_location_unregistered() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let stranger = Address::generate(&env);
    env.mock_all_auths();
    client.update_participant_location(&stranger, &0, &0);
}

#[test]
fn test_update_location_deprecated_alias_works() {
    let env = Env::default();
    let (client, participant) = setup(&env);

    // update_location is a deprecated alias — must produce the same result
    let via_alias = client.update_location(&participant, &48_000_000, &2_000_000);
    let via_new = client.get_participant(&participant).unwrap();

    assert_eq!(via_alias.latitude, 48_000_000);
    assert_eq!(via_new.latitude, 48_000_000);
}
