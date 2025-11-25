"""Email notification utilities."""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Iterable, Optional

from ..config import Settings, get_settings

logger = logging.getLogger("procurahub.email")


class EmailService:
    """Simple email dispatch service with console fallback."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def send_email(
        self, 
        recipients: Iterable[str], 
        subject: str, 
        body: str,
        html_body: Optional[str] = None
    ) -> None:
        """Send an email notification.

        In demo mode, messages are emitted to the application logger so the flow
        can be observed without a real SMTP gateway.
        
        Args:
            recipients: List of email addresses
            subject: Email subject line
            body: Plain text email body
            html_body: Optional HTML email body for rich formatting
        """
        recipients = [
            str(recipient).strip()
            for recipient in recipients
            if recipient and str(recipient).strip()
        ]
        if not recipients:
            return

        if self.settings.email_console_fallback:
            body_to_log = html_body if html_body else body
            logger.info(
                "[EMAIL:%s] To=%s Subject=%s",
                self.settings.email_sender,
                ", ".join(recipients),
                subject,
            )
            logger.debug("Body: %s", body_to_log[:200] + "..." if len(body_to_log) > 200 else body_to_log)
        else:
            # Send via SMTP
            try:
                self._send_smtp(recipients, subject, body, html_body)
                logger.info(
                    "✓ Email sent successfully to %s (subject=%s)", 
                    ", ".join(recipients), 
                    subject
                )
            except Exception as e:
                # Log error but don't raise - emails are non-critical
                logger.warning(
                    "✗ Failed to send email to %s (subject=%s): %s. Email will not be delivered.", 
                    ", ".join(recipients), 
                    subject,
                    str(e)
                )
                # Don't raise - background tasks should not crash the app
    
    def _send_smtp(
        self, 
        recipients: list[str], 
        subject: str, 
        body: str,
        html_body: Optional[str] = None
    ) -> None:
        """Send email via SMTP."""
        if not self.settings.smtp_username or not self.settings.smtp_password:
            raise ValueError("SMTP username and password must be configured")
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['From'] = self.settings.email_sender
        msg['To'] = ", ".join(recipients)
        msg['Subject'] = subject
        
        # Attach plain text version
        part1 = MIMEText(body, 'plain', 'utf-8')
        msg.attach(part1)
        
        # Attach HTML version if provided
        if html_body:
            part2 = MIMEText(html_body, 'html', 'utf-8')
            msg.attach(part2)
        
        # Send email using SSL or TLS
        try:
            if self.settings.smtp_use_ssl:
                # Use SSL (port 465)
                with smtplib.SMTP_SSL(self.settings.smtp_host, self.settings.smtp_port) as server:
                    server.login(self.settings.smtp_username, self.settings.smtp_password)
                    server.sendmail(self.settings.email_sender, recipients, msg.as_string())
            else:
                # Use STARTTLS (port 587)
                with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port) as server:
                    if self.settings.smtp_use_tls:
                        server.starttls()
                    server.login(self.settings.smtp_username, self.settings.smtp_password)
                    server.sendmail(self.settings.email_sender, recipients, msg.as_string())
        except Exception as e:
            logger.error(
                "SMTP connection failed (host=%s, port=%s, ssl=%s, tls=%s): %s",
                self.settings.smtp_host,
                self.settings.smtp_port,
                self.settings.smtp_use_ssl,
                self.settings.smtp_use_tls,
                str(e)
            )
            raise


email_service = EmailService(get_settings())
