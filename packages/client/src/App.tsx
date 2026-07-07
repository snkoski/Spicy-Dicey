import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { GamePage } from './features/game/GamePage';
import { OnlinePage } from './features/online/OnlinePage';
import { SimulatorPage } from './features/simulator/SimulatorPage';
import { BuilderPage } from './features/strategy-builder/BuilderPage';

export function App() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Spicy Dicey</h1>
        <p className="text-sm text-slate-500">Farkle / Hot Dice — play it, then prove it</p>
      </header>
      <Tabs defaultValue="play">
        <TabsList>
          <TabsTrigger value="play">Play</TabsTrigger>
          <TabsTrigger value="online">Online</TabsTrigger>
          <TabsTrigger value="simulator">Simulator</TabsTrigger>
          <TabsTrigger value="builder">Strategy builder</TabsTrigger>
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
      </Tabs>
    </main>
  );
}
