// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PipelineSubscription
/// @notice Manages subscription tiers and model training quotas for the Rapid CV Pipeline.
///         Users subscribe or claim testnet quota (3 model trainings per subscription period).
contract PipelineSubscription {
    uint256 public constant QUOTA_PER_PERIOD = 3;
    uint256 public constant SUBSCRIPTION_DURATION = 30 days;
    uint256 public subscriptionFee = 0.001 ether; // 0.001 0G ETH (or free on testnet)

    address public owner;

    struct Subscription {
        uint256 periodStart;
        uint256 periodEnd;
        uint256 trainingsUsed;
        bool active;
    }

    mapping(address => Subscription) public subscriptions;

    event Subscribed(address indexed user, uint256 periodStart, uint256 periodEnd);
    event QuotaConsumed(address indexed user, uint256 remainingQuota);
    event FeeUpdated(uint256 newFee);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /// @notice Subscribe or renew subscription for 30 days with 3 training credits
    function subscribe() external payable {
        require(msg.value >= subscriptionFee, "Insufficient payment");

        Subscription storage sub = subscriptions[msg.sender];
        sub.periodStart = block.timestamp;
        sub.periodEnd = block.timestamp + SUBSCRIPTION_DURATION;
        sub.trainingsUsed = 0;
        sub.active = true;

        if (msg.value > subscriptionFee) {
            payable(msg.sender).transfer(msg.value - subscriptionFee);
        }

        emit Subscribed(msg.sender, sub.periodStart, sub.periodEnd);
    }

    /// @notice Consumes 1 model training credit if subscriber has quota remaining
    function consumeTrainingQuota(address user) external returns (uint256 remainingQuota) {
        Subscription storage sub = subscriptions[user];
        require(sub.active, "No active subscription");
        require(block.timestamp <= sub.periodEnd, "Subscription expired");
        require(sub.trainingsUsed < QUOTA_PER_PERIOD, "Training quota exhausted (3/3 used)");

        sub.trainingsUsed += 1;
        remainingQuota = QUOTA_PER_PERIOD - sub.trainingsUsed;

        emit QuotaConsumed(user, remainingQuota);
    }

    /// @notice Get remaining training credits for user
    function getRemainingQuota(address user) external view returns (uint256 remainingQuota, uint256 periodEnd, bool active) {
        Subscription memory sub = subscriptions[user];
        if (!sub.active || block.timestamp > sub.periodEnd) {
            return (0, sub.periodEnd, false);
        }
        if (sub.trainingsUsed >= QUOTA_PER_PERIOD) {
            return (0, sub.periodEnd, true);
        }
        return (QUOTA_PER_PERIOD - sub.trainingsUsed, sub.periodEnd, true);
    }

    function setSubscriptionFee(uint256 newFee) external onlyOwner {
        subscriptionFee = newFee;
        emit FeeUpdated(newFee);
    }

    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}
