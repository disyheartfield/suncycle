/**
 * useFollowRoute.js
 *
 * This requests permission, handles denial/services being off, and cancels pending requests when you end following or leave.
 *  The map remains responsible for supplying positions.
 * Manages location permission, position and heading for the Follow Route feature.
 *
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import * as Location from 'expo-location';

export function useFollowRoute() {
  const [followState, setFollowState] = useState('idle');
  const [userLocation, setUserLocation] = useState(null);

  // Prevent a delayed permission response from restarting follow mode.
  const requestId = useRef(0);
  const requestingPermission = useRef(false);

  const endFollowing = useCallback(() => {
    requestId.current += 1;
    requestingPermission.current = false;
    setUserLocation(null);
    setFollowState('idle');
  }, []);

  const requestFollow = useCallback(() => {
    endFollowing();
    setFollowState('requesting_rationale');
  }, [endFollowing]);

  const startAfterRationale = useCallback(async () => {
    if (requestingPermission.current) return;

    requestingPermission.current = true;
    const id = ++requestId.current;
    setFollowState('requesting_permission');

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (id !== requestId.current) return;

      if (!servicesEnabled) {
        setFollowState('services_disabled');
        return;
      }

      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (id !== requestId.current) return;

      if (!permission.granted) {
        setFollowState('denied');
        return;
      }

      setUserLocation(null);
      setFollowState('following');
    } catch (error) {
      if (id !== requestId.current) return;

      endFollowing();
      Alert.alert(
        'Could not enable location',
        error?.message || 'Please try again.'
      );
    } finally {
      if (id === requestId.current) {
        requestingPermission.current = false;
      }
    }
  }, [endFollowing]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') {
        endFollowing();
      }
    });

    return () => {
      requestId.current += 1;
      requestingPermission.current = false;
      subscription.remove();
    };
  }, [endFollowing]);

  return {
    followState,
    userLocation,
    setUserLocation,
    userHeading: null,
    requestFollow,
    startAfterRationale,
    endFollowing,
    dismissDenied: endFollowing,
    dismissServicesDisabled: endFollowing,
  };
}