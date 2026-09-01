-- Support Conversations
CREATE TABLE IF NOT EXISTS support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT DEFAULT 'Support Request',
  status TEXT NOT NULL DEFAULT 'open', -- open | closed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support Messages
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  sender_role TEXT NOT NULL, -- 'user' | 'admin'
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Help Center Articles
CREATE TABLE IF NOT EXISTS help_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- 'getting-started' | 'trading' | 'deposits' | 'account' | 'security'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_published BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_articles ENABLE ROW LEVEL SECURITY;

-- Policies: users see their own conversations
CREATE POLICY "Users can view own conversations"
  ON support_conversations FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Users can insert own conversations"
  ON support_conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update conversations"
  ON support_conversations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') OR user_id = auth.uid());

CREATE POLICY "Users can view messages in own conversations"
  ON support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_conversations
      WHERE id = conversation_id
      AND (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
      ))
    )
  );

CREATE POLICY "Users/admins can send messages"
  ON support_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Help articles are public to authenticated users
CREATE POLICY "Authenticated users can read help articles"
  ON help_articles FOR SELECT
  TO authenticated
  USING (is_published = true);

CREATE POLICY "Admins can manage help articles"
  ON help_articles FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Seed initial help articles
INSERT INTO help_articles (category, title, body, sort_order) VALUES
  ('getting-started', 'How do I create an account?', 'To create an account, visit our sign-up page and enter your full name, email address, and a secure password. You will receive a verification code by email to confirm your identity.', 1),
  ('getting-started', 'How do I verify my identity (KYC)?', 'Go to Profile → KYC Verification and follow the steps to submit your government-issued ID. Our team reviews submissions within 1-3 business days.', 2),
  ('getting-started', 'What currencies are supported?', 'We support deposits and withdrawals in USD via bank transfer or crypto. Contact support if you need help with a specific currency.', 3),
  ('trading', 'How does Live Trading (AI) work?', 'Live Trading uses an AI signal engine to determine trade outcomes. You select an asset, enter an amount, and choose Call (price goes up) or Put (price goes down). Trades resolve in your chosen time frame.', 1),
  ('trading', 'What is Broker Trading?', 'Broker Trading (formerly Live Trading) gives you access to managed signal trades curated by expert analysts. When an active signal is available for your chosen asset, you can enter the position.', 2),
  ('trading', 'How are trade profits calculated?', 'Profit is calculated as: Stake × Profit% / 100. For example, a $100 trade with 85% profit returns $85 on a win — total payout $185.', 3),
  ('deposits', 'How do I deposit funds?', 'Go to Wallet → Deposit. Select your preferred method (e.g. crypto or bank transfer) and follow the on-screen instructions. Your balance updates once the payment is confirmed.', 1),
  ('deposits', 'How long do deposits take?', 'Crypto deposits are usually confirmed within 10-30 minutes. Bank transfers may take 1-3 business days depending on your bank.', 2),
  ('deposits', 'How do I withdraw my funds?', 'Go to Wallet → Withdraw, enter the amount and destination details, then submit. Withdrawals are reviewed and processed within 1-2 business days.', 3),
  ('account', 'How do I change my password?', 'For security, passwords are linked to your email. If you need a reset, use the "Forgot Password" option on the login page.', 1),
  ('account', 'How do I update my profile name?', 'Go to Profile and tap the "Edit" button at the top right. Update your name and tap Save.', 2),
  ('security', 'Is my data secure?', 'Yes. We use industry-standard encryption for all data at rest and in transit. Two-factor authentication via OTP is required for new account sign-ups.', 1),
  ('security', 'I noticed suspicious activity on my account. What should I do?', 'Contact support immediately via Live Chat. We can temporarily suspend your account while we investigate.', 2)
ON CONFLICT DO NOTHING;
