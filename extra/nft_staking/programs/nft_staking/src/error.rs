use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Maximum stake reached")]
    MaxStake,

    #[msg("Staking has not matured yet")]
    StakeNotMatured,

    #[msg("No points available to claim")]
    NoPointsToClaim,

    #[msg("Insufficient balance in rewards account")]
    InsufficientRewardsBalance,
}
