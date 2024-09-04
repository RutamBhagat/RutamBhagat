use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The NFT is already staked")]
    AlreadyStaked,
    #[msg("The NFT attributes are not initialized")]
    AttributesNotInitialized,
    #[msg("Not staked")]
    NotStaked,
    #[msg("Overflow")]
    Overflow,
    #[msg("Underflow")]
    Underflow,
    #[msg("Invalid timestamp")]
    InvalidTimestamp,
}
