import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

/**
 * ToS / Privacy ship as required pages (plan §1 Phase 6); the legal text
 * itself is explicitly out of scope there, so these hold clear placeholders
 * for counsel-approved copy.
 */
export function TermsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Terms of Service</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-600">
        <p>
          Spicy Dicey is provided as-is for entertainment. By playing you agree to keep chat civil,
          not to abuse the service, and that game results may be stored with your account.
        </p>
        <p className="italic">
          Placeholder — replace with counsel-approved terms before public launch.
        </p>
      </CardContent>
    </Card>
  );
}

export function PrivacyPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy Policy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-600">
        <p>
          We store your email, display name, and game statistics when you create an account. Guest
          sessions and their game records are deleted automatically at expiry. Chat messages are
          never persisted. We never sell your data.
        </p>
        <p className="italic">
          Placeholder — replace with counsel-approved policy before public launch.
        </p>
      </CardContent>
    </Card>
  );
}
