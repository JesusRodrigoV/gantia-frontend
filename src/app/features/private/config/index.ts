export { default as Config } from './config';

// Sub-component barrel exports
export { AbsolutePointerCalibration } from './absolute-pointer-calibration';
export { CalibrationPanel } from './calibration-panel';
export { GestureFormDialog } from './gesture-form-dialog';
export { GestureList } from './gesture-list';
export { LearningWizard } from './learning-wizard';
export { TestMode } from './test-mode';

// Services
export { GestureCrudService } from './services/gesture-crud.service';
export { CalibrationCrudService } from './services/calibration-crud.service';

// Models
export type { AbsCalibrationData } from './models/config.model';
export type { CornerName, CornerStep } from './models/absolute-pointer-calibration.model';
