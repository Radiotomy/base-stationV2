import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Credit packages available for purchase
const CREDIT_PACKAGES = {
  starter:  { credits: 500,   price_cents: 499,   label: "Starter" },
  creator:  { credits: 1500,  price_cents: 999,   label: "Creator" },
  pro:      { credits: 5000,  price_cents: 2499,  label: "Pro" },
  studio:   { credits: 15000, price_cents: 5999,  label: "Studio" },
};

// Premium subscription tiers
const SUBSCRIPTION_TIERS = {
  creator_monthly: { credits_per_month: 2000, price_cents: 999,  label: "Creator Monthly", monthly_limit: 2000 },
  pro_monthly:     { credits_per_month: 8000, price_cents: 2999, label: "Pro Monthly",     monthly_limit: 8000 },
  studio_monthly:  { credits_per_month: 25000,price_cents: 7999, label: "Studio Monthly",  monthly_limit: 25000 },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, package_id, subscription_tier, payment_method } = body;

    // Return available packages/tiers
    if (action === 'get_packages') {
      return Response.json({ packages: CREDIT_PACKAGES, subscriptions: SUBSCRIPTION_TIERS });
    }

    // Purchase a one-time credit pack
    if (action === 'purchase_pack') {
      const pack = CREDIT_PACKAGES[package_id];
      if (!pack) return Response.json({ error: 'Invalid package' }, { status: 400 });

      // Get or create user credit record
      let credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
      let creditRecord = credits[0] || null;

      if (!creditRecord) {
        creditRecord = await base44.asServiceRole.entities.UserCredit.create({
          user_id: user.id,
          user_email: user.email,
          balance: 0,
          lifetime_earned: 0,
          lifetime_spent: 0,
          monthly_limit: 1000,
          monthly_used: 0,
          is_premium: false,
        });
      }

      const newBalance = (creditRecord.balance || 0) + pack.credits;

      await base44.asServiceRole.entities.UserCredit.update(creditRecord.id, {
        balance: newBalance,
        lifetime_earned: (creditRecord.lifetime_earned || 0) + pack.credits,
        last_purchase: new Date().toISOString(),
      });

      // Log the transaction
      await base44.asServiceRole.entities.CreditLog.create({
        user_id: user.id,
        user_email: user.email,
        transaction_type: 'purchase',
        amount: pack.credits,
        balance_before: creditRecord.balance || 0,
        balance_after: newBalance,
        description: `Purchased ${pack.label} pack — ${pack.credits} credits`,
        metadata: { package_id, price_cents: pack.price_cents, payment_method: payment_method || 'simulated' },
      });

      return Response.json({
        success: true,
        credits_added: pack.credits,
        new_balance: newBalance,
        message: `Successfully added ${pack.credits.toLocaleString()} credits!`,
      });
    }

    // Activate a subscription tier
    if (action === 'activate_subscription') {
      const tier = SUBSCRIPTION_TIERS[subscription_tier];
      if (!tier) return Response.json({ error: 'Invalid subscription tier' }, { status: 400 });

      let credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
      let creditRecord = credits[0] || null;

      const resetDate = new Date();
      resetDate.setMonth(resetDate.getMonth() + 1);

      const creditsToAdd = tier.credits_per_month;
      const currentBalance = creditRecord?.balance || 0;
      const newBalance = currentBalance + creditsToAdd;

      if (!creditRecord) {
        creditRecord = await base44.asServiceRole.entities.UserCredit.create({
          user_id: user.id,
          user_email: user.email,
          balance: newBalance,
          lifetime_earned: creditsToAdd,
          lifetime_spent: 0,
          monthly_limit: tier.monthly_limit,
          monthly_used: 0,
          is_premium: true,
          reset_date: resetDate.toISOString().split('T')[0],
          last_purchase: new Date().toISOString(),
        });
      } else {
        await base44.asServiceRole.entities.UserCredit.update(creditRecord.id, {
          balance: newBalance,
          lifetime_earned: (creditRecord.lifetime_earned || 0) + creditsToAdd,
          monthly_limit: tier.monthly_limit,
          monthly_used: 0,
          is_premium: true,
          reset_date: resetDate.toISOString().split('T')[0],
          last_purchase: new Date().toISOString(),
        });
      }

      // Log the subscription activation
      await base44.asServiceRole.entities.CreditLog.create({
        user_id: user.id,
        user_email: user.email,
        transaction_type: 'purchase',
        amount: creditsToAdd,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Activated ${tier.label} subscription — ${creditsToAdd} credits/month`,
        metadata: { subscription_tier, price_cents: tier.price_cents, payment_method: payment_method || 'simulated' },
      });

      return Response.json({
        success: true,
        subscription_tier,
        credits_added: creditsToAdd,
        new_balance: newBalance,
        message: `${tier.label} subscription activated! ${creditsToAdd.toLocaleString()} credits added.`,
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});