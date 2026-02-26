import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetATMsQuery } from '../services/pulseApi';
import { selectATM, closeSidePanel } from '../store/uiSlice';
import { RootState } from '../store';
import ATMMapComponent from '../components/map/ATMMap';
import SidePanel from '../components/map/SidePanel';

export default function ATMMap() {
  const dispatch = useDispatch();
  const { selectedATMId, isSidePanelOpen } = useSelector((s: RootState) => s.ui);
  const { data: atms = [], isLoading, error } = useGetATMsQuery();

  const selectedATM = atms.find((a: any) => a.id === selectedATMId) ?? null;

  const handleATMClick = (atm: any) => {
    dispatch(selectATM(atm.id === selectedATMId ? null : atm.id));
  };

  return (
    <div className="p-8 space-y-4 h-screen flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ATM Map</h1>
        <p className="text-sm text-gray-500 mt-1">
          {atms.length} terminals · click a marker to inspect
        </p>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Map */}
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="w-full h-full bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center text-gray-400 text-sm">
              Loading ATMs...
            </div>
          ) : error ? (
            <div className="w-full h-full bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center justify-center gap-2">
              <AlertCircle size={32} className="text-amber-400" />
              <p className="text-gray-500 text-sm">ATM model not yet implemented in the backend.</p>
              <p className="text-gray-400 text-xs">Create the ATM model in <code className="bg-gray-100 px-1 rounded">ATM/models.py</code>.</p>
            </div>
          ) : (
            <ATMMapComponent
              atms={atms}
              selectedId={selectedATMId}
              onATMClick={handleATMClick}
            />
          )}
        </div>

        {/* Side panel */}
        {isSidePanelOpen && selectedATM && (
          <SidePanel atm={selectedATM} onClose={() => dispatch(closeSidePanel())} />
        )}
      </div>
    </div>
  );
}
