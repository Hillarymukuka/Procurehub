"""Timezone utilities for converting between UTC and user timezones."""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional


def convert_utc_to_user_timezone(utc_dt: datetime, user_timezone: str = "Africa/Cairo") -> datetime:
    """
    Convert a UTC datetime to the user's timezone.
    
    Args:
        utc_dt: DateTime in UTC
        user_timezone: User's timezone (e.g., 'Africa/Cairo', 'UTC', 'America/New_York')
        
    Returns:
        DateTime converted to user's timezone
    """
    if utc_dt is None:
        return None
    
    # Ensure the datetime is timezone-aware (UTC)
    if utc_dt.tzinfo is None:
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)
    
    # Convert to user's timezone
    user_tz = ZoneInfo(user_timezone)
    return utc_dt.astimezone(user_tz)


def convert_user_timezone_to_utc(local_dt: datetime, user_timezone: str = "Africa/Cairo") -> datetime:
    """
    Convert a datetime from the user's timezone to UTC.
    
    Args:
        local_dt: DateTime in user's local timezone
        user_timezone: User's timezone (e.g., 'Africa/Cairo', 'UTC', 'America/New_York')
        
    Returns:
        DateTime converted to UTC
    """
    if local_dt is None:
        return None
    
    # If datetime is naive (no timezone info), assume it's in the user's timezone
    if local_dt.tzinfo is None:
        user_tz = ZoneInfo(user_timezone)
        local_dt = local_dt.replace(tzinfo=user_tz)
    
    # Convert to UTC
    return local_dt.astimezone(timezone.utc)


def get_current_time_in_timezone(user_timezone: str = "Africa/Cairo") -> datetime:
    """
    Get the current time in the user's timezone.
    
    Args:
        user_timezone: User's timezone (e.g., 'Africa/Cairo', 'UTC', 'America/New_York')
        
    Returns:
        Current datetime in the user's timezone
    """
    now_utc = datetime.now(timezone.utc)
    user_tz = ZoneInfo(user_timezone)
    return now_utc.astimezone(user_tz)


def format_datetime_for_user(utc_dt: datetime, user_timezone: str = "Africa/Cairo", 
                             format_string: str = "%Y-%m-%d %H:%M:%S") -> str:
    """
    Format a UTC datetime as a string in the user's timezone.
    
    Args:
        utc_dt: DateTime in UTC
        user_timezone: User's timezone
        format_string: Python datetime format string
        
    Returns:
        Formatted datetime string in user's timezone
    """
    if utc_dt is None:
        return ""
    
    local_dt = convert_utc_to_user_timezone(utc_dt, user_timezone)
    return local_dt.strftime(format_string)


# Common timezone options
COMMON_TIMEZONES = [
    "Africa/Cairo",
    "UTC",
    "Africa/Johannesburg",
    "Africa/Nairobi",
    "Europe/London",
    "Europe/Paris",
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
    "Asia/Dubai",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Australia/Sydney",
]
