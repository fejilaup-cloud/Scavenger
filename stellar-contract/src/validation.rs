use soroban_sdk::{Address, Env};

#[allow(dead_code)]
pub fn validate_positive_amount(amount: i128, field_name: &str) {
    if amount <= 0 {
        panic!("{} must be positive", field_name);
    }
}

#[allow(dead_code)]
pub fn validate_percentage(percentage: u32, field_name: &str) {
    if percentage > 100 {
        panic!("{} must be <= 100", field_name);
    }
}

pub fn validate_coordinates(latitude: i128, longitude: i128) {
    const MAX_LAT: i128 = 90_000_000;
    const MAX_LON: i128 = 180_000_000;

    if !(-MAX_LAT..=MAX_LAT).contains(&latitude) {
        panic!("Latitude must be between -90 and +90 degrees");
    }

    if !(-MAX_LON..=MAX_LON).contains(&longitude) {
        panic!("Longitude must be between -180 and +180 degrees");
    }
}

#[allow(dead_code)]
pub fn validate_address_not_contract(env: &Env, address: &Address) {
    if address == &env.current_contract_address() {
        panic!("Address cannot be the contract itself");
    }
}

#[allow(dead_code)]
pub fn validate_addresses_different(addr1: &Address, addr2: &Address, context: &str) {
    if addr1 == addr2 {
        panic!("{}: addresses must be different", context);
    }
}

#[allow(dead_code)]
pub fn validate_positive_u128(amount: u128, field_name: &str) {
    if amount == 0 {
        panic!("{} must be greater than zero", field_name);
    }
}
