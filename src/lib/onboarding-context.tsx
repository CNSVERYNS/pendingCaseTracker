import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';

import type { CaseEventKind, FormType } from '@/lib/database.types';

export interface OnboardingMilestone {
  kind: CaseEventKind;
  occurredOn: string;
  occurredAtTime?: string | null;
}

export interface OnboardingState {
  receiptNumber: string;
  isOnlineFiling: boolean;
  officeCode: string | null;
  officeLabel: string | null;
  lookupStatusTitle: string | null;
  lookupStatusText: string | null;
  lookupFailed: boolean;
  formType: FormType | null;
  filedOn: string | null;
  milestones: OnboardingMilestone[];
}

const initialState: OnboardingState = {
  receiptNumber: '',
  isOnlineFiling: false,
  officeCode: null,
  officeLabel: null,
  lookupStatusTitle: null,
  lookupStatusText: null,
  lookupFailed: false,
  formType: null,
  filedOn: null,
  milestones: [],
};

type Action =
  | { type: 'SET_RECEIPT'; receiptNumber: string; isOnlineFiling: boolean }
  | { type: 'SET_OFFICE'; officeCode: string | null; officeLabel: string | null }
  | {
      type: 'SET_LOOKUP';
      statusTitle: string | null;
      statusText: string | null;
      formType: FormType | null;
      filedOn: string | null;
      failed: boolean;
    }
  | { type: 'SET_FORM_TYPE'; formType: FormType }
  | { type: 'SET_FILED_ON'; filedOn: string }
  | { type: 'SET_MILESTONE'; milestone: OnboardingMilestone }
  | { type: 'REMOVE_MILESTONE'; kind: CaseEventKind }
  | { type: 'RESET' };

function reducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case 'SET_RECEIPT':
      return { ...state, receiptNumber: action.receiptNumber, isOnlineFiling: action.isOnlineFiling };
    case 'SET_OFFICE':
      return { ...state, officeCode: action.officeCode, officeLabel: action.officeLabel };
    case 'SET_LOOKUP':
      return {
        ...state,
        lookupStatusTitle: action.statusTitle,
        lookupStatusText: action.statusText,
        formType: action.formType ?? state.formType,
        // Prefilled from the API's submittedDate when available (§10) — the
        // filing-date step still shows it for the user to confirm or change.
        filedOn: action.filedOn ?? state.filedOn,
        lookupFailed: action.failed,
      };
    case 'SET_FORM_TYPE':
      return { ...state, formType: action.formType };
    case 'SET_FILED_ON':
      return { ...state, filedOn: action.filedOn };
    case 'SET_MILESTONE': {
      const rest = state.milestones.filter((m) => m.kind !== action.milestone.kind);
      return { ...state, milestones: [...rest, action.milestone] };
    }
    case 'REMOVE_MILESTONE':
      return { ...state, milestones: state.milestones.filter((m) => m.kind !== action.kind) };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface OnboardingContextValue {
  state: OnboardingState;
  setReceipt: (receiptNumber: string, isOnlineFiling: boolean) => void;
  setOffice: (officeCode: string | null, officeLabel: string | null) => void;
  setLookup: (
    statusTitle: string | null,
    statusText: string | null,
    formType: FormType | null,
    filedOn: string | null,
    failed: boolean,
  ) => void;
  setFormType: (formType: FormType) => void;
  setFiledOn: (filedOn: string) => void;
  setMilestone: (milestone: OnboardingMilestone) => void;
  removeMilestone: (kind: CaseEventKind) => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setReceipt = useCallback(
    (receiptNumber: string, isOnlineFiling: boolean) => dispatch({ type: 'SET_RECEIPT', receiptNumber, isOnlineFiling }),
    [],
  );
  const setOffice = useCallback(
    (officeCode: string | null, officeLabel: string | null) => dispatch({ type: 'SET_OFFICE', officeCode, officeLabel }),
    [],
  );
  const setLookup = useCallback(
    (
      statusTitle: string | null,
      statusText: string | null,
      formType: FormType | null,
      filedOn: string | null,
      failed: boolean,
    ) => dispatch({ type: 'SET_LOOKUP', statusTitle, statusText, formType, filedOn, failed }),
    [],
  );
  const setFormType = useCallback((formType: FormType) => dispatch({ type: 'SET_FORM_TYPE', formType }), []);
  const setFiledOn = useCallback((filedOn: string) => dispatch({ type: 'SET_FILED_ON', filedOn }), []);
  const setMilestone = useCallback((milestone: OnboardingMilestone) => dispatch({ type: 'SET_MILESTONE', milestone }), []);
  const removeMilestone = useCallback((kind: CaseEventKind) => dispatch({ type: 'REMOVE_MILESTONE', kind }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const value = useMemo(
    () => ({ state, setReceipt, setOffice, setLookup, setFormType, setFiledOn, setMilestone, removeMilestone, reset }),
    [state, setReceipt, setOffice, setLookup, setFormType, setFiledOn, setMilestone, removeMilestone, reset],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return ctx;
}
