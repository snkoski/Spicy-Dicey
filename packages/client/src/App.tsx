import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { AccountPage } from './features/account/AccountPage';
import { GamePage } from './features/game/GamePage';
import { OnlinePage } from './features/online/OnlinePage';
import { SimulatorPage } from './features/simulator/SimulatorPage';
import { BuilderPage } from './features/strategy-builder/BuilderPage';

const queryClient = new QueryClient();

export function App() {
  const [tab, setTab] = useState('play');
  return (
    <QueryClientProvider client={queryClient}>
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <header>
          <h1 className="text-2xl font-bold">Spicy Dicey</h1>
          <p className="text-sm text-slate-500">Farkle / Hot Dice — play it, then prove it</p>
        </header>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="play">Play</TabsTrigger>
            <TabsTrigger value="online">Online</TabsTrigger>
            <TabsTrigger value="simulator">Simulator</TabsTrigger>
            <TabsTrigger value="builder">Strategy builder</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>
          <TabsContent value="play">
            <GamePage />
          </TabsContent>
          <TabsContent value="online">
            <OnlinePage />
          </TabsContent>
          <TabsContent value="simulator">
            <SimulatorPage />
          </TabsContent>
          <TabsContent value="builder">
            <BuilderPage />
          </TabsContent>
          <TabsContent value="account">
            <AccountPage active={tab === 'account'} />
          </TabsContent>
        </Tabs>
      </main>
    </QueryClientProvider>
  );
}
