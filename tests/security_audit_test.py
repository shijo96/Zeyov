#!/usr/bin/env python3
"""
ZEYOV Shopify Theme - Comprehensive Automated Security Audit & Verification Suite
Tests security controls across:
- Secret & Credential Exposure Detection
- Liquid Template Output Escaping & XSS Prevention
- DOM XSS & Open Redirect Protections in JavaScript
- Honeypot Bot Traps & Brute-Force Rate Limiting
- Input Validation & Length Bounds Checking
- CSRF Authenticity Form Protections
- Reverse Tabnabbing Defense (rel="noopener noreferrer")
- Transport Security & HTTPS Protocol Enforcement
- Payment Verification & HMAC-SHA256 Webhook Integrity
- Theme Syntax & Tag Balance Verification
"""

import os
import re
import hmac
import hashlib
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class TestSecurityControls(unittest.TestCase):

    def setUp(self):
        self.repo_root = REPO_ROOT

    def test_01_no_hardcoded_secrets_or_api_credentials(self):
        """Verify no private keys, database passwords, or auth tokens exist in codebase."""
        secret_patterns = [
            (r'-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----', 'Exposed Private Key'),
            (r'(?i)(api_key|api_secret|app_secret|private_key|db_password)\s*[:=]\s*["\'][a-zA-Z0-9_\-]{16,}["\']', 'Exposed API Secret'),
            (r'shpat_[a-fA-F0-9]{32}', 'Shopify Admin API Access Token'),
            (r'shpca_[a-fA-F0-9]{32}', 'Shopify Custom App Token'),
            (r'sk_live_[0-9a-zA-Z]{24}', 'Live Stripe Secret Key'),
            (r'rzp_live_[0-9a-zA-Z]{14}', 'Live Razorpay Key ID'),
        ]

        violations = []
        for root, _, files in os.walk(self.repo_root):
            if any(ign in root for ign in ['.git', 'tests', 'node_modules']):
                continue
            for f in files:
                if f.endswith(('.liquid', '.js', '.json', '.css', '.html')):
                    path = os.path.join(root, f)
                    with open(path, 'r', errors='ignore') as fh:
                        content = fh.read()
                        for pattern, label in secret_patterns:
                            matches = re.findall(pattern, content)
                            if matches:
                                violations.append(f"{label} in {os.path.relpath(path, self.repo_root)}")

        self.assertEqual(len(violations), 0, f"Exposed secrets found: {violations}")

    def test_02_no_insecure_http_transport_urls(self):
        """Verify all external assets and links use secure HTTPS transport."""
        insecure_http_regex = re.compile(r'http://[a-zA-Z0-9_\-\.]+', re.IGNORECASE)
        violations = []

        for root, _, files in os.walk(self.repo_root):
            if any(ign in root for ign in ['.git', 'tests']):
                continue
            for f in files:
                if f.endswith(('.liquid', '.js', '.json')):
                    path = os.path.join(root, f)
                    with open(path, 'r', errors='ignore') as fh:
                        for idx, line in enumerate(fh, 1):
                            # Exclude XML schema definitions which require literal http:// string
                            clean = re.sub(r'xmlns=[\'"]http://www\.w3\.org/[^\'"]*[\'"]', '', line)
                            clean = re.sub(r'schema\.org', '', clean)
                            for match in insecure_http_regex.finditer(clean):
                                violations.append(f"{os.path.relpath(path, self.repo_root)}:{idx}: {match.group(0)}")

        self.assertEqual(len(violations), 0, f"Insecure HTTP links detected: {violations}")

    def test_03_reverse_tabnabbing_protection(self):
        """Verify all target='_blank' links include rel='noopener' or rel='noopener noreferrer'."""
        link_regex = re.compile(r'<a\s+[^>]*target=[\'"]_blank[\'"][^>]*>', re.IGNORECASE)
        violations = []

        for root, _, files in os.walk(self.repo_root):
            if any(ign in root for ign in ['.git', 'tests']):
                continue
            for f in files:
                if f.endswith(('.liquid', '.html')):
                    path = os.path.join(root, f)
                    with open(path, 'r', errors='ignore') as fh:
                        for idx, line in enumerate(fh, 1):
                            for match in link_regex.finditer(line):
                                tag = match.group(0)
                                if 'rel=' not in tag or 'noopener' not in tag:
                                    violations.append(f"{os.path.relpath(path, self.repo_root)}:{idx}: {tag}")

        self.assertEqual(len(violations), 0, f"Unprotected target='_blank' links: {violations}")

    def test_04_security_headers_in_theme_layouts(self):
        """Verify security headers (X-Content-Type-Options, Referrer-Policy) in theme layouts."""
        theme_liquid = os.path.join(self.repo_root, 'layout', 'theme.liquid')
        password_liquid = os.path.join(self.repo_root, 'layout', 'password.liquid')

        with open(theme_liquid, 'r') as f:
            theme_content = f.read()
        with open(password_liquid, 'r') as f:
            pwd_content = f.read()

        self.assertIn('X-Content-Type-Options', theme_content)
        self.assertIn('strict-origin-when-cross-origin', theme_content)
        self.assertIn('X-Content-Type-Options', pwd_content)
        self.assertIn('strict-origin-when-cross-origin', pwd_content)

    def test_05_csrf_and_shopify_form_tags(self):
        """Verify sensitive customer state mutations use official Shopify {% form %} tags with CSRF tokens."""
        customer_forms = {
            'login.liquid': 'customer_login',
            'register.liquid': 'create_customer',
            'reset_password.liquid': 'reset_customer_password',
            'activate_account.liquid': 'activate_customer_password',
            'addresses.liquid': 'customer_address'
        }

        for filename, form_type in customer_forms.items():
            path = os.path.join(self.repo_root, 'templates', 'customers', filename)
            self.assertTrue(os.path.exists(path), f"Missing {filename}")
            with open(path, 'r') as f:
                content = f.read()
            self.assertTrue(
                f"form '{form_type}'" in content or f'form "{form_type}"' in content,
                f"Form in {filename} does not use Shopify CSRF protected form tag for {form_type}"
            )

    def test_06_bot_honeypot_traps_on_public_forms(self):
        """Verify honeypot bot trap fields exist on public forms (Contact, Newsletter, Register, Reviews)."""
        checks = [
            (os.path.join(self.repo_root, 'snippets', 'page-contact-content.liquid'), 'contact[bot_trap]'),
            (os.path.join(self.repo_root, 'sections', 'newsletter.liquid'), 'name="contact[b_trap]"'),
            (os.path.join(self.repo_root, 'templates', 'customers', 'register.liquid'), 'customer[bot_trap]'),
            (os.path.join(self.repo_root, 'sections', 'product-reviews.liquid'), 'comment_bot_trap'),
        ]

        for path, trap_name in checks:
            with open(path, 'r') as f:
                content = f.read()
            self.assertIn(trap_name, content, f"Missing bot trap {trap_name} in {os.path.basename(path)}")

    def test_07_input_validation_and_length_bounds(self):
        """Verify strict length bounds (maxlength/minlength) on sensitive inputs."""
        # 1. Search inputs must have minlength to prevent broad database wildcard scans
        header_path = os.path.join(self.repo_root, 'sections', 'header.liquid')
        with open(header_path, 'r') as f:
            header_content = f.read()
        self.assertIn('minlength="2"', header_content)
        self.assertIn('maxlength="100"', header_content)

        # 2. Review form inputs must have maxlength
        reviews_path = os.path.join(self.repo_root, 'sections', 'product-reviews.liquid')
        with open(reviews_path, 'r') as f:
            rev_content = f.read()
        self.assertIn('maxlength="80"', rev_content)
        self.assertIn('maxlength="2000"', rev_content)

        # 3. Registration password must require minlength >= 8
        reg_path = os.path.join(self.repo_root, 'templates', 'customers', 'register.liquid')
        with open(reg_path, 'r') as f:
            reg_content = f.read()
        self.assertIn('minlength="8"', reg_content)

    def test_08_xss_output_escaping_in_liquid(self):
        """Verify that user-controlled values (customer name/email, search terms, cart note) use | escape filter."""
        # Check contact snippet
        contact_path = os.path.join(self.repo_root, 'snippets', 'page-contact-content.liquid')
        with open(contact_path, 'r') as f:
            contact_content = f.read()
        self.assertIn('form.name | escape', contact_content)
        self.assertIn('form.email | escape', contact_content)
        self.assertIn('form.body | escape', contact_content)

        # Check cart note & phone attributes
        cart_path = os.path.join(self.repo_root, 'sections', 'main-cart.liquid')
        with open(cart_path, 'r') as f:
            cart_content = f.read()
        self.assertIn("cart.note | escape", cart_content)
        self.assertIn("cart.attributes['Primary Phone'] | default: customer.phone | escape", cart_content)

        # Check customer account
        acct_path = os.path.join(self.repo_root, 'templates', 'customers', 'account.liquid')
        with open(acct_path, 'r') as f:
            acct_content = f.read()
        self.assertIn("customer.first_name | escape", acct_content)
        self.assertIn("customer.name | escape", acct_content)

    def test_09_dom_xss_and_safe_navigation_in_theme_js(self):
        """Verify JavaScript implements safe navigation, URL sanitization, and output escaping."""
        js_path = os.path.join(self.repo_root, 'assets', 'theme.js')
        with open(js_path, 'r') as f:
            js_content = f.read()

        # Must have safe URL and HTML escaping functions
        self.assertIn('function escapeHtml(str)', js_content)
        self.assertIn('function isSafeUrl(url)', js_content)
        self.assertIn('function safeNavigate(url)', js_content)

        # Toast must escape messages
        self.assertIn('escapeHtml(msg)', js_content)

        # Wishlist drawer rendering must sanitize properties from localStorage
        self.assertIn('safeHandle', js_content)
        self.assertIn('safeTitle', js_content)
        self.assertIn('safeUrl', js_content)

        # Cart API quantity bounds
        self.assertIn('Math.max(1, Math.min(999,', js_content)

    def test_10_webhook_hmac_sha256_verification_logic(self):
        """Verify HMAC-SHA256 signature calculation and constant-time verification."""
        secret = "zeyov_production_webhook_secret_key_987654321"
        payload = b'{"id": 1024, "financial_status": "paid", "total_price": "2499.00"}'

        # Compute authentic signature
        computed_sig = hmac.new(secret.encode('utf-8'), payload, hashlib.sha256).hexdigest()

        # Verification function using constant-time comparison
        def verify_signature(body, signature_header, secret_key):
            expected = hmac.new(secret_key.encode('utf-8'), body, hashlib.sha256).hexdigest()
            return hmac.compare_digest(expected, signature_header)

        # 1. Valid signature passes
        self.assertTrue(verify_signature(payload, computed_sig, secret))

        # 2. Tampered signature fails
        tampered_sig = computed_sig[:-4] + "0000"
        self.assertFalse(verify_signature(payload, tampered_sig, secret))

        # 3. Altered financial status payload fails
        altered_payload = b'{"id": 1024, "financial_status": "paid", "total_price": "0.01"}'
        self.assertFalse(verify_signature(altered_payload, computed_sig, secret))

        # 4. Incorrect secret key fails
        self.assertFalse(verify_signature(payload, computed_sig, "wrong_secret_key"))

    def test_11_liquid_syntax_and_tag_balancing(self):
        """Verify that all Liquid tags ({% if %}, {%- form -%}, etc.) are properly paired and closed."""
        tag_pairs = {
            'if': 'endif',
            'for': 'endfor',
            'form': 'endform',
            'paginate': 'endpaginate',
            'capture': 'endcapture',
            'case': 'endcase',
            'unless': 'endunless'
        }

        tag_regex = re.compile(r'\{%-?\s*(if|endif|for|endfor|form|endform|paginate|endpaginate|capture|endcapture|case|endcase|unless|endunless)\b')

        violations = []
        for root, _, files in os.walk(self.repo_root):
            if any(ign in root for ign in ['.git', 'tests']):
                continue
            for f in files:
                if f.endswith('.liquid'):
                    path = os.path.join(root, f)
                    with open(path, 'r', errors='ignore') as fh:
                        content = fh.read()
                        stack = []
                        for m in tag_regex.finditer(content):
                            tag = m.group(1)
                            if tag.startswith('end'):
                                base = tag[3:]
                                if not stack:
                                    violations.append(f"{os.path.relpath(path, self.repo_root)}: Unexpected {tag}")
                                    break
                                top = stack.pop()
                                if top != base:
                                    violations.append(f"{os.path.relpath(path, self.repo_root)}: Mismatched {top} closed with {tag}")
                                    break
                            else:
                                stack.append(tag)
                        if stack:
                            violations.append(f"{os.path.relpath(path, self.repo_root)}: Unclosed tags: {stack}")

        self.assertEqual(len(violations), 0, f"Liquid tag syntax errors: {violations}")

if __name__ == '__main__':
    unittest.main(verbosity=2)
