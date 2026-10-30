import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import quote

def send_password_reset_email(to_email: str, user_name: str, reset_token: str) -> dict:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    reset_link = f"{frontend_url}/#reset-password?token={reset_token}&email={quote(to_email)}"

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    from_email = os.getenv("FROM_EMAIL", smtp_user or "noreply@studypilot.ai").strip()

    subject = "StudyPilot AI — Reset Your Password"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your StudyPilot AI Password</title>
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
        .card {{ max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }}
        .brand {{ display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 20px; color: #0a6c9e; margin-bottom: 24px; }}
        .btn {{ display: inline-block; background-color: #0a6c9e; color: #ffffff !important; text-decoration: none; padding: 13px 26px; border-radius: 8px; font-weight: 700; font-size: 15px; margin: 24px 0; }}
        .link-box {{ background: #f1f5f9; padding: 12px 14px; border-radius: 8px; font-size: 12px; word-break: break-all; color: #475569; }}
        .footer {{ margin-top: 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 18px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="brand">
          <span>🚀 StudyPilot AI</span>
        </div>
        <h2>Password Reset Request</h2>
        <p>Hello <strong>{user_name}</strong>,</p>
        <p>We received a request to reset the password for your StudyPilot account (<strong>{to_email}</strong>).</p>
        <p>Click the button below to choose a new password. This link is valid for <strong>30 minutes</strong>.</p>
        <div style="text-align: center;">
          <a href="{reset_link}" class="btn" target="_blank">Reset My Password</a>
        </div>
        <p style="font-size: 13px; color: #64748b;">If the button above does not work, copy and paste this link into your web browser:</p>
        <div class="link-box">{reset_link}</div>
        <div class="footer">
          <p>If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          <p>&copy; StudyPilot AI — Intelligent Learning & Examination Preparation Platform.</p>
        </div>
      </div>
    </body>
    </html>
    """

    plain_text = f"""
Hello {user_name},

We received a request to reset your StudyPilot account password ({to_email}).
Use the link below to set a new password (valid for 30 minutes):

{reset_link}

If you did not request this, please ignore this email.

StudyPilot AI
    """

    # If SMTP is configured, attempt sending real email
    if smtp_user and smtp_password:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = from_email
            msg["To"] = to_email

            part1 = MIMEText(plain_text, "plain")
            part2 = MIMEText(html_content, "html")
            msg.attach(part1)
            msg.attach(part2)

            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(from_email, [to_email], msg.as_string())

            print(f"[Email Service] Password reset email successfully sent via SMTP to: {to_email}")
            return {
                "sent": True,
                "method": "smtp",
                "reset_link": reset_link,
                "email": to_email
            }
        except Exception as e:
            print(f"[Email Service Error] SMTP delivery failed ({e}). Falling back to simulation link.")

    # Local development / simulation fallback
    print("=" * 70)
    print(f"[EMAIL DISPATCH] Password Reset Email for {to_email} ({user_name})")
    print(f"Direct Reset Link: {reset_link}")
    print("=" * 70)

    return {
        "sent": True,
        "method": "simulated" if not (smtp_user and smtp_password) else "fallback",
        "reset_link": reset_link,
        "email": to_email
    }

