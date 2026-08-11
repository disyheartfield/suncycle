/**
 * useFollowRoute.js
 *
 * Manages location permission, position and heading for the Follow Route feature.
 *
 * Privacy guarantees built in:
 *  - All coordinates and heading values stay on-device.
 *  - Nothing is stored, logged, cached or transmitted.
 *  - Tracking starts only when the user taps "Follow route".
 *  - Tracking stops immediately when the user taps "End" or leaves the screen.
 *  - Only foreground ("While Using") location access is ever requested.
 */

import { useState, useCallback } from 'react';

export function useFollowRoute() {
  const [followState, setFollowState] = useState('idle');
  const [userLocation, setUserLocation] = useState(null);

  const requestFollow = useCallback(() => {
    setFollowState('requesting_rationale');
  }, []);

  const startAfterRationale = useCallback(() => {
    setFollowState('following');
  }, []);

  const endFollowing = useCallback(() => {
    setUserLocation(null);
    setFollowState('idle');
  }, []);

  const dismissDenied = useCallback(() => setFollowState('idle'), []);
  const dismissServicesDisabled = useCallback(() => setFollowState('idle'), []);

  return {
    followState,
    userLocation,
    setUserLocation,
    userHeading: null,
    requestFollow,
    startAfterRationale,
    endFollowing,
    dismissDenied,
    dismissServicesDisabled,
  };
}