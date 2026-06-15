import { getUncachableStripeClient } from "../server/stripeClient";

/**
 * Creates the WILL Premium subscription product and its $5.99/month price in Stripe.
 * Idempotent — safe to run multiple times. Webhooks sync the data to the local stripe schema.
 *
 * Run with: npx tsx scripts/seed-products.ts
 */
async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log("Creating WILL Premium product and price in Stripe...");

    const existing = await stripe.products.search({
      query: "name:'WILL Premium' AND active:'true'",
    });

    let product = existing.data[0];
    if (product) {
      console.log(`WILL Premium already exists: ${product.id}`);
    } else {
      product = await stripe.products.create({
        name: "WILL Premium",
        description: "Full access to WILL — goal accountability, circles, and progress tracking.",
      });
      console.log(`Created product: ${product.name} (${product.id})`);
    }

    // Check for an existing active monthly recurring price
    const prices = await stripe.prices.list({ product: product.id, active: true });
    const monthly = prices.data.find(
      (p) => p.recurring?.interval === "month" && p.unit_amount === 599
    );

    if (monthly) {
      console.log(`Monthly $5.99 price already exists: ${monthly.id}`);
    } else {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 599, // $5.99
        currency: "usd",
        recurring: { interval: "month" },
      });
      console.log(`Created monthly price: $5.99/month (${price.id})`);
    }

    console.log("✓ Done. Webhooks will sync this to the database automatically.");
  } catch (error: any) {
    console.error("Error creating products:", error?.message || error);
    process.exit(1);
  }
}

createProducts();
