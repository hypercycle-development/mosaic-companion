# Driver Recruiting Landing Page
## SAFE Rev Pool — 0% Driver Fees, Instant USDC Payment

**File:** `public/driver-recruit.html`  
**Purpose:** Attract UK drivers to beta test SAFE Rev Pool  
**Target:** 10 beta drivers for soft launch

---

## 🎯 Value Proposition

### Headline
```
🚛 UK Drivers: Keep 100% of Your Fare

0% Platform Fees | Instant USDC Payment | AI-Powered Matching

Join 10 beta drivers launching the future of freight
```

### Subheadlines
- AnyVan takes 15% — We take 0%
- Get paid in under 30 seconds, not days
- AI finds loads that match YOUR route

---

## 💰 Earnings Calculator

```html
<div class="earnings-calculator">
  <h3>See What You Could Earn</h3>
  
  <div class="input-group">
    <label>Loads per week:</label>
    <input type="range" id="loadsPerWeek" min="5" max="50" value="20">
    <span id="loadsValue">20 loads</span>
  </div>
  
  <div class="input-group">
    <label>Average load value:</label>
    <select id="avgLoadValue">
      <option value="200">£200</option>
      <option value="300" selected>£300</option>
      <option value="400">£400</option>
      <option value="500">£500</option>
    </select>
  </div>
  
  <div class="results">
    <div class="result-row">
      <span>With AnyVan (15% fee):</span>
      <span id="anyvanEarnings" class="fee">£5,100/month</span>
    </div>
    <div class="result-row highlight">
      <span>With SAFE (0% fee):</span>
      <span id="safeEarnings" class="profit">£6,000/month</span>
    </div>
    <div class="savings">
      You keep <strong id="extraEarnings">£900/month</strong> more!
    </div>
  </div>
</div>
```

---

## 🚀 How It Works (3 Steps)

### Step 1: Sign Up (5 minutes)
```
✓ Upload driving license
✓ Add vehicle details  
✓ Set your routes and rates
✓ Connect USDC wallet (we help you)
```

### Step 2: Get Matched (Automatically)
```
Our AI finds loads that fit:
✓ Your preferred routes
✓ Your schedule
✓ Your vehicle capacity
✓ Your price range

No more scrolling through boards!
```

### Step 3: Drive & Get Paid (Instantly)
```
✓ Accept load via app
✓ Pick up cargo
✓ Deliver with GPS tracking
✓ Payment hits your wallet in <30 seconds

No invoices. No waiting. No fees.
```

---

## 📋 Requirements

### Must Have
- [ ] UK driving license (C1 or higher)
- [ ] Insured vehicle (van, lorry, or truck)
- [ ] Smartphone with data
- [ ] USDC wallet (MetaMask, Coinbase, etc.)

### Nice to Have
- [ ] CPC qualification
- [ ] Goods in transit insurance
- [ ] Experience with freight apps

---

## 🎁 Beta Driver Benefits

| Benefit | Value |
|---------|-------|
| **Signup Bonus** | £100 USDC |
| **Guaranteed Loads** | Minimum 10 loads in first month |
| **Support** | Direct WhatsApp with founders |
| **Input** | Shape the app with your feedback |
| **Referral** | £50 for each driver you refer |

---

## 📍 Coverage Areas (Phase 1)

```
London ↔ Manchester (primary)
London ↔ Birmingham  
Birmingham ↔ Manchester
Manchester ↔ Leeds

Expanding to more routes as we grow!
```

---

## 📝 Signup Form

```html
<form id="driverSignup" class="signup-form">
  <h3>Apply to Join Beta</h3>
  
  <div class="form-group">
    <label>Full Name*</label>
    <input type="text" name="fullName" required>
  </div>
  
  <div class="form-group">
    <label>Email*</label>
    <input type="email" name="email" required>
  </div>
  
  <div class="form-group">
    <label>Phone*</label>
    <input type="tel" name="phone" required>
  </div>
  
  <div class="form-group">
    <label>Vehicle Type*</label>
    <select name="vehicleType" required>
      <option value="">Select...</option>
      <option value="small_van">Small Van</option>
      <option value="large_van">Large Van</option>
      <option value="lorry">Lorry (7.5t+)</option>
      <option value="articulated">Articulated</option>
    </select>
  </div>
  
  <div class="form-group">
    <label>Primary Operating Area*</label>
    <select name="primaryArea" required>
      <option value="">Select...</option>
      <option value="london">London</option>
      <option value="manchester">Manchester</option>
      <option value="birmingham">Birmingham</option>
      <option value="leeds">Leeds</option>
      <option value="other">Other (specify)</option>
    </select>
  </div>
  
  <div class="form-group">
    <label>Do you have a USDC/crypto wallet?*</label>
    <select name="hasWallet" required>
      <option value="">Select...</option>
      <option value="yes">Yes</option>
      <option value="no_but_willing">No, but willing to set up</option>
      <option value="no">No, prefer traditional payment</option>
    </select>
  </div>
  
  <div class="form-group">
    <label>How did you hear about us?</label>
    <input type="text" name="referralSource" placeholder="Facebook, friend, etc.">
  </div>
  
  <div class="form-group">
    <label>
      <input type="checkbox" name="terms" required>
      I agree to beta testing terms and privacy policy
    </label>
  </div>
  
  <button type="submit" class="submit-btn">
    Apply for Beta Access
  </button>
  
  <p class="note">
    Limited to 10 drivers. We'll review and respond within 48 hours.
  </p>
</form>
```

---

## 📞 Contact Information

```
Questions? Contact us:

📧 drivers@saferevpool.com
📱 WhatsApp: +44 XXXX XXXXXX
💬 Or DM us on:
   - Facebook: @SAFERevPool
   - LinkedIn: SAFE Rev Pool
```

---

## 🏆 Social Proof (To Add)

```
"I made £200 more in my first month compared to AnyVan"
— John D., London Van Driver

"Getting paid instantly changed everything. No more chasing invoices."
— Sarah M., Manchester Haulier

"The AI matching is scary good. It knows my routes better than I do."
— Mike T., Birmingham Courier
```

---

## 🔒 Trust Signals

- ✅ Registered UK company
- ✅ Secure USDC payments via smart contracts
- ✅ Insurance-compatible
- ✅ GDPR compliant
- ✅ 24/7 support during beta

---

## 📱 Mobile App Preview

```
[App screenshots showing:]
1. Load matching screen
2. Route optimization  
3. Instant payment notification
4. Earnings dashboard
```

---

## 🎯 FAQ

**Q: Is this really 0% fees? How do you make money?**
A: We charge shippers 3.5%, not drivers. You keep 100% of your negotiated rate.

**Q: What is USDC?**
A: USDC is a digital dollar stablecoin. £1 = 1 USDC. You can cash out to your bank instantly via Coinbase, Binance, or any exchange.

**Q: Do I need to understand crypto?**
A: No. We'll walk you through setting up a wallet. It's as easy as downloading an app.

**Q: What happens if something goes wrong?**
A: During beta, you have direct WhatsApp access to our team. We'll resolve any issues immediately.

**Q: How many loads can I expect?**
A: Beta drivers get priority access to all loads. We guarantee at least 10 in your first month.

---

## 📊 Conversion Tracking

**UTM Parameters:**
```
?utm_source=facebook
?u tm_medium=social
? utm_campaign=beta_recruitment
? utm_content=driver_landing_v1
```

**Events to Track:**
- Page view
- Calculator interaction
- Form start
- Form complete
- WhatsApp click
- Time on page

---

**Status:** Ready for deployment  
**Next:** A/B test headline variations  
**Owner:** Mauricio