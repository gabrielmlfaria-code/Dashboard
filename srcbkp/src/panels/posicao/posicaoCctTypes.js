/** @typedef {'pending'|'analyzed'|'error'} CctStatus */

/**
 * @typedef {Object} CctAlert
 * @property {'alto'|'medio'|'baixo'} severity
 * @property {string} title
 * @property {string} description
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {string} summary
 * @property {string|null} validityPeriod
 * @property {string|null} parties
 * @property {string|null} validFrom
 * @property {string|null} validUntil
 * @property {CctAlert[]} alerts
 * @property {Object} workingHours
 * @property {Object} overtime
 * @property {Object} breaks
 * @property {Object} timeTracking
 * @property {Object} remoteWork
 * @property {Object} nightShift
 */

/**
 * @typedef {Object} CctRecord
 * @property {string} id
 * @property {string} label
 * @property {string} fileName
 * @property {number} sizeBytes
 * @property {number|null} pageCount
 * @property {CctStatus} status
 * @property {string|null} validUntil
 * @property {string|null} validFrom
 * @property {AnalysisResult|null} analysisResult
 * @property {boolean} isScanned
 * @property {string} importedAt
 * @property {'idb'|'opfs'|'memory'} [storage]
 */

export {};
