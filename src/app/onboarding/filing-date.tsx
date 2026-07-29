import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { DateField } from '@/components/date-field';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { strings } from '@/constants/strings';
import { useOnboarding } from '@/lib/onboarding-context';

export default function FilingDateStep() {
  const { state, setFiledOn } = useOnboarding();
  const [value, setValue] = useState<string | null>(state.filedOn);

  function handleContinue() {
    if (!value) return;
    setFiledOn(value);
    if (state.isOnlineFiling) {
      router.push('/onboarding/zip');
    } else {
      router.push('/onboarding/milestones');
    }
  }

  return (
    <OnboardingScreen
      step={2}
      totalSteps={5}
      title={strings.onboarding.filingDate.title}
      subtitle={strings.onboarding.filingDate.subtitle}
      footer={<Button label={strings.common.continue} disabled={!value} onPress={handleContinue} />}
    >
      <DateField label={strings.onboarding.filingDate.label} value={value} onChange={setValue} maximumDate={new Date()} />
    </OnboardingScreen>
  );
}
