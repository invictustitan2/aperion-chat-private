import {
  AlertCircle,
  Download,
  Search,
  Send,
  Trash2,
  User,
} from "lucide-react";
import { useState } from "react";
import {
  Button,
  Card,
  ConversationListSkeleton,
  Input,
  MessageSkeleton,
  Skeleton,
} from "../components/ui";

/**
 * UI Lab - Component Testing & Visual Regression
 *
 * Internal development route for testing UI components.
 * NOT included in production builds.
 *
 * Access at: /ui-lab (development only)
 */

export function UILab() {
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState("");

  return (
    <div className="min-h-screen p-8 space-y-12 bg-gradient-to-br from-slate-900 via-gray-900 to-black">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-baseline gap-4 mb-2">
          <h1 className="text-4xl font-bold text-white">Aperion UI Lab</h1>
          <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-xs font-mono rounded-full">
            DEV ONLY
          </span>
        </div>
        <p className="text-gray-400">
          Component testing and visual regression for Aperion UI primitives.
        </p>
      </div>

      <div className="max-w-7xl mx-auto space-y-16">
        {/* Buttons */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            Buttons
          </h2>
          <Card variant="glass-dark" padding="lg">
            <div className="space-y-8">
              {/* Variants */}
              <div>
                <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">
                  Variants
                </h3>
                <div className="flex flex-wrap gap-4">
                  <Button variant="primary">Primary Button</Button>
                  <Button variant="secondary">Secondary Button</Button>
                  <Button variant="ghost">Ghost Button</Button>
                  <Button variant="danger">Danger Button</Button>
                </div>
              </div>

              {/* Sizes */}
              <div>
                <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">
                  Sizes
                </h3>
                <div className="flex flex-wrap items-center gap-4">
                  <Button size="xs">Extra Small</Button>
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>

              {/* With Icons */}
              <div>
                <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">
                  With Icons
                </h3>
                <div className="flex flex-wrap gap-4">
                  <Button leftIcon={<Send className="w-4 h-4" />}>
                    Send Message
                  </Button>
                  <Button
                    variant="secondary"
                    rightIcon={<Download className="w-4 h-4" />}
                  >
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    leftIcon={<Search className="w-4 h-4" />}
                  >
                    Search
                  </Button>
                </div>
              </div>

              {/* States */}
              <div>
                <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">
                  States
                </h3>
                <div className="flex flex-wrap gap-4">
                  <Button isLoading>Loading...</Button>
                  <Button disabled>Disabled</Button>
                  <Button fullWidth>Full Width Button</Button>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Inputs */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            Inputs
          </h2>
          <Card variant="glass-dark" padding="lg">
            <div className="space-y-6 max-w-2xl">
              <Input
                label="Username"
                placeholder="Enter your username..."
                helperText="This will be your display name"
              />

              <Input
                label="Email"
                type="email"
                placeholder="your@email.com"
                leftIcon={<User className="w-4 h-4" />}
              />

              <Input
                label="Search"
                placeholder="Search conversations..."
                leftIcon={<Search className="w-4 h-4" />}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />

              <Input
                label="With Error"
                placeholder="This field has an error"
                error={inputError || "This is an error message"}
                rightIcon={<AlertCircle className="w-4 h-4" />}
              />

              <button
                onClick={() => setInputError("Validation failed!")}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Trigger Error State
              </button>

              <Input disabled placeholder="Disabled input" label="Disabled" />
            </div>
          </Card>
        </section>

        {/* Cards */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            Cards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card variant="default" padding="md">
              <h3 className="text-lg font-semibold text-white mb-2">
                Default Card
              </h3>
              <p className="text-gray-400">
                Standard card with white/10 background and border.
              </p>
            </Card>

            <Card variant="glass" padding="md">
              <h3 className="text-lg font-semibold text-white mb-2">
                Glass Card
              </h3>
              <p className="text-gray-400">
                Semi-transparent with backdrop blur effect.
              </p>
            </Card>

            <Card variant="glass-dark" padding="md">
              <h3 className="text-lg font-semibold text-white mb-2">
                Glass Dark Card
              </h3>
              <p className="text-gray-400">
                Darker glass variant for nested content.
              </p>
            </Card>

            <Card variant="elevated" padding="md">
              <h3 className="text-lg font-semibold text-white mb-2">
                Elevated Card
              </h3>
              <p className="text-gray-400">Card with shadow elevation.</p>
            </Card>

            <Card variant="glass-dark" padding="md" hoverable>
              <h3 className="text-lg font-semibold text-white mb-2">
                Hoverable Card
              </h3>
              <p className="text-gray-400">
                Hover over me to see the interaction!
              </p>
            </Card>
          </div>
        </section>

        {/* Skeletons */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            Loading States (Skeletons)
          </h2>
          <Card variant="glass-dark" padding="lg">
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">
                  Basic Skeletons
                </h3>
                <div className="space-y-3">
                  <Skeleton width={200} height={20} />
                  <Skeleton width={300} height={20} />
                  <Skeleton width={150} height={20} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">
                  Message Skeleton
                </h3>
                <div className="space-y-6">
                  <MessageSkeleton />
                  <MessageSkeleton isUser />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">
                  Conversation List Skeleton
                </h3>
                <div className="max-w-xs">
                  <ConversationListSkeleton count={3} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">
                  Circular & Rectangular
                </h3>
                <div className="flex gap-4">
                  <Skeleton variant="circular" width={60} height={60} />
                  <Skeleton variant="rectangular" width={200} height={60} />
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Component Combinations */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            Component Combinations
          </h2>
          <Card variant="glass-dark" padding="lg">
            <div className="space-y-6 max-w-2xl">
              {/* Form Example */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">
                  Example Form
                </h3>
                <Input
                  label="Email"
                  type="email"
                  placeholder="your@email.com"
                  leftIcon={<User className="w-4 h-4" />}
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                />
                <div className="flex gap-3">
                  <Button variant="primary" fullWidth>
                    Sign In
                  </Button>
                  <Button variant="ghost">Cancel</Button>
                </div>
              </div>

              {/* Alert Example */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-emerald-400 mb-1">
                    Success
                  </h4>
                  <p className="text-sm text-gray-300">
                    Your changes have been saved successfully.
                  </p>
                </div>
              </div>

              {/* Action Bar Example */}
              <div className="flex items-center justify-between p-4 glass rounded-xl">
                <div>
                  <h4 className="font-semibold text-white">Delete Account</h4>
                  <p className="text-sm text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 className="w-4 h-4" />}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {/* Design Tokens Reference */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            Design Tokens
          </h2>
          <Card variant="glass-dark" padding="lg">
            <div className="space-y-6">
              {/* Colors */}
              <div>
                <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">
                  Primary Colors
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map(
                    (shade) => (
                      <div key={shade} className="space-y-2">
                        <div
                          className={`h-16 rounded-lg bg-primary-${shade}`}
                        />
                        <p className="text-xs font-mono text-gray-400">
                          primary-{shade}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {/* Spacing */}
              <div>
                <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">
                  Spacing Scale
                </h3>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 6, 8, 12, 16, 24].map((space) => (
                    <div key={space} className="flex items-center gap-4">
                      <code className="text-xs font-mono text-gray-400 w-20">
                        gap-{space}
                      </code>
                      <div
                        className="h-4 bg-emerald-500 rounded"
                        style={{ width: `${space * 0.25}rem` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto pt-12 pb-24 text-center">
        <p className="text-gray-500 text-sm font-mono">
          Aperion UI Lab • Development Environment Only • Not for Production
        </p>
      </div>
    </div>
  );
}
