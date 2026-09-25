import { isEnableBankingConfigured, listBanks, type Aspsp } from "@/lib/bank/enablebanking";
import { getAccounts, requestTime } from "@/lib/queries";
import { AccountCard, AddAccountForm, ConnectBankForm, ImportForm, SyncButton } from "@/components/account-forms";
import { Card, Money, PageHeader, SectionHeader } from "@/components/ui";

export const metadata = { title: "Accounts" };

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  const sp = await searchParams;
  const accounts = await getAccounts();
  const configured = isEnableBankingConfigured();

  let banks: Aspsp[] = [];
  let bankListError: string | null = null;
  if (configured) {
    try {
      banks = await listBanks("FR");
    } catch (e) {
      bankListError = e instanceof Error ? e.message : String(e);
    }
  }

  const now = await requestTime();
  const total = accounts.reduce((s, a) => s + (a.balanceCents ?? 0), 0);
  const linked = accounts.filter((a) => a.provider === "enablebanking");
  const bankError = typeof sp.bank_error === "string" ? sp.bank_error : null;
  const connected = typeof sp.connected === "string" ? Number(sp.connected) : null;

  return (
    <div className="space-y-14">
      <PageHeader
        title="Accounts"
        eyebrow={accounts.length ? <>Total <Money cents={total} className="text-ink-2" /></> : "Bring in your transactions"}
        action={linked.length > 0 ? <SyncButton /> : undefined}
      />

      {bankError && <p className="rounded-2xl bg-bad-soft px-5 py-4 text-[13px] text-bad">Couldn&rsquo;t connect the bank: {bankError}</p>}
      {connected !== null && (
        <p className="rounded-2xl border border-line px-5 py-4 text-[13px] text-ink-2">
          Connected {connected} {connected === 1 ? "account" : "accounts"} and imported {sp.added ?? 0} transactions.
        </p>
      )}

      {accounts.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2">
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} now={now} />
          ))}
        </section>
      )}

      <section>
        <SectionHeader title="Connect CCF" subtitle="Read-only access through open banking (PSD2). Transactions sync by themselves." />
        <Card className="p-6 sm:p-8">
          {configured ? (
            bankListError ? (
              <p className="text-[13px] text-bad">Couldn&rsquo;t load the list of banks: {bankListError}</p>
            ) : (
              <ConnectBankForm banks={banks.map((b) => ({ name: b.name, logo: b.logo ?? null }))} />
            )
          ) : (
            <SetupInstructions />
          )}
        </Card>
      </section>

      <section>
        <SectionHeader title="Import a statement" subtitle="Download an OFX or CSV file from CCF online banking and drop it here. Re-importing the same period is safe — duplicates are skipped." />
        <Card className="p-6 sm:p-8">
          <ImportForm accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
        </Card>
      </section>

      <section>
        <SectionHeader title="Add an account by hand" subtitle="For a cash wallet, or to import statements into." />
        <Card className="p-6 sm:p-8">
          <AddAccountForm />
        </Card>
      </section>
    </div>
  );
}

function SetupInstructions() {
  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-ink-2">
      <p className="font-display text-[22px] text-ink">A one-time setup, about ten minutes</p>
      <ol className="list-decimal space-y-3 pl-5 marker:text-ink-3">
        <li>
          Create a free account at <a className="text-ink underline decoration-accent-mark underline-offset-[3px]" href="https://enablebanking.com/cp/" target="_blank" rel="noreferrer">enablebanking.com</a> and register an application
          (environment <em>Production</em>, redirect URL <code className="rounded bg-surface-2 px-1">https://&lt;your-app&gt;/api/bank/callback</code>).
        </li>
        <li>In the control panel, link your CCF account(s) — this activates free &ldquo;restricted&rdquo; access to your own accounts.</li>
        <li>
          Put the application id and the downloaded private key in <code className="rounded bg-surface-2 px-1">.env.local</code>:
          <pre className="mt-2 overflow-x-auto rounded-xl bg-surface-2 p-3 text-[12px] leading-relaxed">
{`ENABLE_BANKING_APP_ID=xxxxxxxx-xxxx-...
ENABLE_BANKING_KEY_PATH=./secrets/enablebanking.pem`}
          </pre>
        </li>
        <li>Restart the app and come back here.</li>
      </ol>
      <p className="text-ink-3">Until then, importing statement files below works just as well — it just isn&rsquo;t automatic.</p>
    </div>
  );
}
