#![cfg(test)]
// fuzz tests for reward distribution math
use proptest::prelude::*;

/// Pure reward-distribution math extracted from `distribute_rewards`.
/// Returns `(total_distributed, recycler_amount)`.
fn calc_reward(
    reward_points: u64,
    weight_grams: u64,
    collector_pct: u32,
    owner_pct: u32,
    num_collectors: u32,
) -> (i128, i128) {
    let weight_kg = (weight_grams / 1000) as i128;
    let total_reward = (reward_points as i128) * weight_kg;

    let collector_share = (total_reward * collector_pct as i128) / 100;
    let owner_share = (total_reward * owner_pct as i128) / 100;

    let total_distributed = collector_share * num_collectors as i128 + owner_share;
    let recycler_amount = total_reward - total_distributed;

    (total_distributed, recycler_amount)
}

proptest! {
    /// Invariant 1: total distributed never exceeds total reward.
    /// Invariant 2: recycler always receives a non-negative amount.
    ///
    /// Percentages are constrained so collector_pct + owner_pct <= 100,
    /// matching the guard in `ScavengerContract::initialize`.
    #[test]
    fn fuzz_reward_distribution(
        reward_points in 1u64..=1_000_000u64,
        weight_grams in 1_000u64..=1_000_000_000u64,  // 1 g – 1 000 000 kg
        collector_pct in 0u32..=100u32,
        owner_pct_offset in 0u32..=100u32,
        num_collectors in 0u32..=20u32,
    ) {
        // Mirror the contract's initialize invariant: sum <= 100
        let owner_pct = owner_pct_offset.min(100 - collector_pct);

        let (total_distributed, recycler_amount) =
            calc_reward(reward_points, weight_grams, collector_pct, owner_pct, num_collectors);

        let total_reward = (reward_points as i128) * ((weight_grams / 1000) as i128);

        prop_assert!(
            total_distributed <= total_reward,
            "total_distributed ({total_distributed}) > total_reward ({total_reward})"
        );
        prop_assert!(
            recycler_amount >= 0,
            "recycler_amount ({recycler_amount}) is negative"
        );
    }
}
