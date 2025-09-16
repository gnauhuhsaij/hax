export type ModalData = {
  stepName: string;
  classification: string;
  subtaskIndex: number;
  stepIndex: number;
  phaseIndex: number;
  subtaskDescription: string;
  workflowName: string;
  context: string;
  evidence: any; // refine later if you know exact structure
  savedAt: number;
};

export type ModalDataCache = Record<string, ModalData>;
