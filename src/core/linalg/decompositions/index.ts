/**
 * Importing this module registers every built-in decomposition with the registry in
 * ../decompose.ts. It is imported once at app start-up. Each decomposition module registers
 * itself as a side effect of being imported.
 */
import './polar';

export { polarDecomposition } from './polar';
