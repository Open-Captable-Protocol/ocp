// Note: This file is kept for documentation purposes only
// The types are not used in JavaScript but are documented here for reference

/**
 * @typedef {Object} AuthResponse
 * @property {string} access_token
 */

/**
 * @typedef {Object} CreateCommand
 * @property {Object} CreateCommand
 * @property {string} CreateCommand.templateId
 * @property {Object} CreateCommand.createArguments
 */

/**
 * @typedef {Object} ExerciseCommand
 * @property {Object} ExerciseCommand
 * @property {string} ExerciseCommand.templateId
 * @property {string} ExerciseCommand.contractId
 * @property {string} ExerciseCommand.choice
 * @property {Object} ExerciseCommand.choiceArgument
 */

/**
 * @typedef {CreateCommand|ExerciseCommand} Command
 */

/**
 * @typedef {Object} CommandRequest
 * @property {Command[]} commands
 * @property {string} commandId
 * @property {string[]} actAs
 */

/**
 * @typedef {Object} CreatedTreeEvent
 * @property {Object} CreatedTreeEvent
 * @property {Object} CreatedTreeEvent.value
 * @property {string} CreatedTreeEvent.value.contractId
 */

/**
 * @typedef {Object} TransactionTree
 * @property {string} updateId
 * @property {Object.<string, CreatedTreeEvent>} eventsById
 */

/**
 * @typedef {Object} CommandResponse
 * @property {TransactionTree} transactionTree
 */

/**
 * @typedef {Object} CreateContractResponse
 * @property {string} contractId
 * @property {string} updateId
 */ 