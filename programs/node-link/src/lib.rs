use anchor_lang::prelude::*;

declare_id!("BzBmVWwhcqohg6vHZ7bNrT6nDDvNcsvbkvc6jHwSLgUK");

const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;
#[program]
pub mod node_link {
    use super::*;

    pub fn register_node(ctx: Context<RegisterNode>) -> Result<()> {
        let node_account = &mut ctx.accounts.node_account;
        node_account.authority = ctx.accounts.authority.key();
        node_account.status = NodeStatus::Available;
        msg!("Node registered for authority: {}", ctx.accounts.authority.key());
        Ok(())
    }
}

// Register node mới
#[derive(Accounts)]
pub struct RegisterNode<'info> {
    #[account(
        init,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR_SIZE + NodeAccount::INIT_SPACE,
        seeds = [b"node", authority.key().as_ref()],
        bump
    )]
    pub node_account: Account<'info, NodeAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct NodeAccount {
    pub authority: Pubkey,
    pub status: NodeStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum NodeStatus {
    Available,
    Busy,
}

// Job
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum JobStatus {
    Pending,
    InProgress,
    Completed,
    PendingVerification,
    Disputed,
    Failed,
}

#[account]
pub struct JobDetail
{
    pub details: Vector<String>,
    pub reward: u64,
}
#[account]
#[derive(InitSpace)]
pub struct JobAccount<'info> {
    #[account(mut)]
    pub node_account: Account<'info, NodeAccount>,
    #[account(mut)]
    pub client: Pubkey,
    pub result: Vector<u8>,
    pub status: JobStatus,
    pub system_program: Program<'info, System>,
}