import dotenv from 'dotenv';
import OnboardingEnquiry from '../models/OnboardingEnquiry.js';

dotenv.config();
try {
  await OnboardingEnquiry.sync();
  console.log('onboarding_enquiries table is ready');
} catch (error) {
  console.error('Unable to create onboarding_enquiries table:', error);
  process.exitCode = 1;
}
