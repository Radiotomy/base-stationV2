import { createContext, useContext } from 'react';

// The live Audiotool session ({ at, nexus, projectUrl, onChanged }) shared with
// every Songstarter surface that can push audio into it.
export const BridgeSessionContext = createContext(null);
export const useBridgeSession = () => useContext(BridgeSessionContext);