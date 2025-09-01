import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';

const LeftBox = () => (
  <div className="bg-blue-200 p-4 rounded shadow w-full h-full flex flex-col justify-center">
    <h2 className="text-xl font-bold mb-1">Left Box</h2>
    <p>This is short content.</p>
    <p>This is short content.</p>
    <p>This is short content.</p>
  </div>
);

const RightBoxWithRef = ({ itemCount }) => {
  const boxRef = useRef(null);
  useLayoutEffect(() => {
    if (boxRef.current) {
      console.log('🟡 BEFORE scroll:', { scrollTop: boxRef.current.scrollTop, scrollHeight: boxRef.current.scrollHeight });
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
      console.log('🟢 AFTER scroll:', { scrollTop: boxRef.current.scrollTop });
    }
  }, [itemCount]);

  const listItems = useMemo(
    () => Array.from({ length: itemCount }).map((_, i) => (
      <li key={i} className="bg-purple-100 p-2 rounded border border-purple-300 text-purple-700">
        🔵 Item {i + 1}
      </li>
    )),
    [itemCount]
  );

  return (
    <div className="bg-purple-200 p-4 rounded shadow h-full w-full flex flex-col">
      <h2 className="text-xl font-bold mb-2">With useRef (Auto Scroll)</h2>
      <div ref={boxRef} className="overflow-y-auto h-auto max-h-[250px] pr-2 flex-grow">
        <ul className="space-y-2">{listItems}</ul>
      </div>
    </div>
  );
};

const RightBoxWithoutRef = ({ itemCount }) => {
  const boxRef = useRef(null);
  useEffect(() => {
    if (boxRef.current) {
      console.log('🔍 Manual Scroll info:', { scrollTop: boxRef.current.scrollTop, scrollHeight: boxRef.current.scrollHeight });
    }
  }, [itemCount]);

  const listItems = useMemo(
    () => Array.from({ length: itemCount }).map((_, i) => (
      <li key={i} className="bg-purple-100 p-2 rounded border border-purple-300 text-purple-700">
        🔴 Item {i + 1}
      </li>
    )),
    [itemCount]
  );

  return (
    <div className="bg-purple-200 p-4 rounded shadow h-full w-full flex flex-col">
      <h2 className="text-xl font-bold mb-2">Without useRef (Manual Scroll)</h2>
      <div ref={boxRef} className="overflow-y-auto h-auto max-h-[250px] pr-2 flex-grow">
        <ul className="space-y-2">{listItems}</ul>
      </div>
    </div>
  );
};

export default function ScrollDemo() {
  const [itemCount, setItemCount] = useState(1);
  const [useRefMode, setUseRefMode] = useState(true);

  useEffect(() => {
    console.log('Rendered. itemCount:', itemCount);
  }, [itemCount]);

  return (
    <div className="min-h-screen p-6 bg-gray-100">
      <h1 className="text-2xl font-bold text-center mb-4">
        Scroll Behavior Comparison: With vs Without useRef
      </h1>

      <div className="text-center mb-4 space-x-2">
        <button
          onClick={() => setItemCount((prev) => Math.max(1, prev - 1))}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-700"
          disabled={itemCount <= 1}
        >
          -
        </button>
        <span className="text-lg font-semibold">{itemCount}</span>
        <button
          onClick={() => setItemCount((prev) => prev + 1)}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-700"
        >
          +
        </button>
      </div>

      <div className="text-center mb-4">
        <button
          onClick={() => setUseRefMode((prev) => !prev)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
        >
          Toggle Mode: {useRefMode ? 'With useRef' : 'Without useRef'}
        </button>
      </div>

      <div className="bg-skyBlue-50 rounded-lg shadow border p-4 max-w-6xl mx-auto h-auto">
        <div className="grid md:grid-cols-2 gap-4 h-full items-start">
          <div className="h-full">
            <LeftBox />
          </div>
          <div className="h-full">
            {useRefMode ? (
              <RightBoxWithRef itemCount={itemCount} />
            ) : (
              <RightBoxWithoutRef itemCount={itemCount} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
