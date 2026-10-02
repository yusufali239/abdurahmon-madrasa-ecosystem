import { createContext, useContext } from 'react';
import type { Me } from './types';

export const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext)!;
