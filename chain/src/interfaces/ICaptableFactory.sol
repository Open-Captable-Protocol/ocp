// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICapTableFactory {
    /// @notice Emitted when a new cap table is created
    /// @param capTable The address of the newly created cap table
    /// @param issuerId The ID of the issuer for this cap table
    event CapTableCreated(address indexed capTable, bytes16 indexed issuerId);

    /// @notice Creates a new cap table with the specified issuer ID and initial shares
    /// @dev Only the owner can create cap tables
    /// @param id The unique identifier for the issuer
    /// @param initialSharesAuthorized The initial number of authorized shares
    /// @return The address of the newly created cap table
    function createCapTable(bytes16 id, uint256 initialSharesAuthorized) external returns (address);

    /// @notice Gets the total number of cap tables created by this factory
    /// @return The number of cap tables
    function getCapTableCount() external view returns (uint256);

    /// @notice Gets the address of a cap table by its index
    /// @param index The index of the cap table
    /// @return The address of the cap table at the specified index
    function capTables(uint256 index) external view returns (address);

    /// @notice Gets the reference diamond address used for copying facets
    /// @return The address of the reference diamond
    function referenceDiamond() external view returns (address);
}
