import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { TextField } from '@/components/text-field';
import { strings } from '@/constants/strings';
import { resolveOfficeByZip } from '@/lib/office-resolver';
import { useOnboarding } from '@/lib/onboarding-context';

export default function ZipStep() {
  const { setOffice } = useOnboarding();
  const [zip, setZip] = useState('');

  function resolveAndContinue() {
    // The ZIP is used for exactly this one lookup and discarded immediately —
    // it is never stored in onboarding state, the database, or sent
    // anywhere beyond this on-device calculation (§8, §11).
    const office = resolveOfficeByZip(zip);
    setOffice(office?.code ?? null, office?.label ?? null);
    router.push('/onboarding/milestones');
  }

  return (
    <OnboardingScreen
      step={3}
      totalSteps={5}
      title={strings.onboarding.zip.title}
      subtitle={strings.onboarding.zip.subtitle}
      footer={
        <>
          <Button label={strings.common.continue} onPress={resolveAndContinue} disabled={zip.trim().length < 5} />
          <Button variant="secondary" label={strings.onboarding.zip.skip} onPress={() => router.push('/onboarding/milestones')} />
        </>
      }
    >
      <TextField
        label={strings.onboarding.zip.label}
        value={zip}
        onChangeText={setZip}
        keyboardType="number-pad"
        maxLength={5}
        mono
      />
    </OnboardingScreen>
  );
}
