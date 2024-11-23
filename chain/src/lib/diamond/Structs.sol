// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct Issuer {
    bytes16 id;
    uint256 shares_issued;
    uint256 shares_authorized;
}

// can be later extended to add things like seniority, conversion_rights, etc.
struct StockClass {
    bytes16 id;
    string class_type; // ["COMMON", "PREFERRED"]
    uint256 price_per_share; // Per-share price this stock class was issued for
    uint256 shares_issued;
    uint256 shares_authorized;
}

struct StockPlan {
    bytes16[] stock_class_ids;
    uint256 shares_reserved;
}

struct StockActivePosition {
    bytes16 stakeholder_id;
    bytes16 stock_class_id;
    uint256 quantity;
    uint256 share_price;
}

struct StockActivePositions {
    mapping(bytes16 => bytes16[]) stakeholderToSecurities;
    mapping(bytes16 => StockActivePosition) securities;
    mapping(bytes16 => bytes16) securityToStakeholder;
}

struct ConvertibleActivePosition {
    bytes16 stakeholder_id;
    uint256 investment_amount;
    // uint256 valuation_cap; // unsure we want to store this
    // uint256 discount_rate; // unsure we want to store this
    // string convertible_type; // ["NOTE", "SAFE"] // do we even care?
}

struct ConvertibleActivePositions {
    mapping(bytes16 => bytes16[]) stakeholderToSecurities;
    mapping(bytes16 => ConvertibleActivePosition) securities;
    mapping(bytes16 => bytes16) securityToStakeholder;
}

struct EquityCompensationActivePosition {
    bytes16 stakeholder_id;
    uint256 quantity;
    uint40 timestamp;
    bytes16 stock_class_id;
    bytes16 stock_plan_id;
}

struct EquityCompensationActivePositions {
    mapping(bytes16 => bytes16[]) stakeholderToSecurities;
    mapping(bytes16 => EquityCompensationActivePosition) securities;
    mapping(bytes16 => bytes16) securityToStakeholder;
}

struct EquityCompensationExercise {
    bytes16 equity_comp_security_id; // The ID of the equity compensation being exercised
    bytes16 resulting_stock_security_id; // The ID of the stock issuance that results from this exercise
    uint256 quantity; // How many shares are being exercised
}

struct WarrantActivePosition {
    bytes16 stakeholder_id;
    uint256 quantity;
}

struct WarrantActivePositions {
    mapping(bytes16 => bytes16[]) stakeholderToSecurities;
    mapping(bytes16 => WarrantActivePosition) securities;
    mapping(bytes16 => bytes16) securityToStakeholder;
}
