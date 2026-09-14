import dotenv from 'dotenv';
import MenuUploadSubmission from '../models/MenuUploadSubmission.js';

dotenv.config();
try {
  await MenuUploadSubmission.sync();
  console.log('menu_upload_submissions table is ready');
} catch (error) {
  console.error('Unable to create menu_upload_submissions table:', error);
  process.exitCode = 1;
}
