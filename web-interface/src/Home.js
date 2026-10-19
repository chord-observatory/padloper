import React from 'react'
import { useEffect, useState } from 'react';
import { getCurrentUser } from './paths.js';
import './login.css'

/**
 * Landing page. Signing in happens at the site proxy (Authelia) before any
 * padloper page loads, so this only shows who is signed in.
 */
export default function Home() {
    // null while loading; {} if the backend could not identify the user.
    const [user, setUser] = useState(null);

    useEffect(() => {
        getCurrentUser().then(setUser);
    }, []);

    return (
      <div className="App">
        <header className="App-header">
          <div className='container'>
            {user === null ? <></> : user.login ?
              <h3>Signed in as {user.login}</h3>
              :
              <h3>Could not identify you. Try reloading the page, or contact
                  an administrator if your account has been deactivated.</h3>
            }
          </div>
        </header>
      </div>
    );
}
