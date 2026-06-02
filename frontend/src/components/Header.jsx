import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserButton, useUser } from '@clerk/clerk-react';

const Header = () => {
    // Used to determine which nav link should be marked as active
    const location = useLocation();
    const { user } = useUser();

    // Builds a display name in the format "FirstName L." from the Clerk user object
    const displayName = user
        ? `${user.firstName ?? ''} ${user.lastName ? user.lastName.charAt(0) + '.' : ''}`.trim()
        : '';

    return (
        <div className="header">

            <div className="header-left">
                <div className="header-logo">
                    <div className="header-logo-icon">
                        <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                            <rect x="6.5" y="1" width="5" height="16" rx="2" fill="white" />
                            <rect x="1" y="6.5" width="16" height="5" rx="2" fill="white" />
                        </svg>
                    </div>
                    <span className="header-logo-wordmark">Diabetic Patient Priority System</span>
                </div>
            </div>

            <nav className="header-nav">
                <Link
                    to="/dashboard"
                    // Appends "active" class to the link whose path matches the current URL
                    className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
                >
                    Dashboard
                </Link>
                <Link
                    to="/analytics"
                    className={`nav-link ${location.pathname === '/analytics' ? 'active' : ''}`}
                >
                    Analytics
                </Link>
            </nav>

            <div className="header-right">
                {/* Shows the abbreviated name next to the Clerk avatar button */}
                <span className="user-name">{displayName}</span>
                <UserButton />
            </div>
        </div>
    );
};

export default Header;