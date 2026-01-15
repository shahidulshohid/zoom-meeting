// 'use client';

// import { useState, useRef, useEffect } from 'react';
// import { initializeApp } from 'firebase/app';
// import {
//     getFirestore,
//     collection,
//     doc,
//     setDoc,
//     getDoc,
//     updateDoc,
//     onSnapshot,
//     deleteDoc,
//     getDocs,
//     serverTimestamp,
//     Timestamp
// } from 'firebase/firestore';
// const firebaseConfig = {
//     apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
//     authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
//     projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
//     storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
//     messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
//     appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
//     measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const db = getFirestore(app);

// // WebRTC Configuration
// const servers = {
//     iceServers: [
//         { urls: "stun:stun.l.google.com:19302" },
//         { urls: "stun:stun1.l.google.com:19302" },
//         { urls: "stun:stun2.l.google.com:19302" },
//         { urls: "stun:stun3.l.google.com:19302" }
//     ]
// };

// // Types
// type StatusType = 'waiting' | 'connected' | 'disconnected';

// interface ButtonsState {
//     camera: boolean;
//     create: boolean;
//     join: boolean;
//     hangup: boolean;
// }

// export default function VideoChat() {
//     // State
//     const [status, setStatus] = useState<{ text: string; type: StatusType }>({
//         text: 'Ready to start! Click "Start Camera" to begin.',
//         type: 'waiting'
//     });
//     const [roomId, setRoomId] = useState<string | null>(null);
//     const [showRoomId, setShowRoomId] = useState(false);
//     const [joinDialogOpen, setJoinDialogOpen] = useState(false);
//     const [joinRoomInput, setJoinRoomInput] = useState('');
//     const [buttonsState, setButtonsState] = useState<ButtonsState>({
//         camera: true,
//         create: false,
//         join: false,
//         hangup: false
//     });

//     // Refs
//     const localVideoRef = useRef<HTMLVideoElement>(null);
//     const remoteVideoRef = useRef<HTMLVideoElement>(null);
//     const pcRef = useRef<RTCPeerConnection | null>(null);
//     const localStreamRef = useRef<MediaStream | null>(null);
//     const remoteStreamRef = useRef<MediaStream | null>(null);
//     const unsubscribeRef = useRef<(() => void) | null>(null);
//     const roomUnsubscribeRef = useRef<(() => void) | null>(null);

//     // Update status helper
//     const updateStatus = (text: string, type: StatusType) => {
//         setStatus({ text, type });
//     };

//     // Open camera and microphone
//     const openMedia = async () => {
//         try {
//             updateStatus('Accessing camera and microphone...', 'waiting');

//             const stream = await navigator.mediaDevices.getUserMedia({
//                 video: {
//                     width: { ideal: 1280 },
//                     height: { ideal: 720 },
//                     frameRate: { ideal: 30 }
//                 },
//                 audio: {
//                     echoCancellation: true,
//                     noiseSuppression: true,
//                     autoGainControl: true
//                 }
//             });

//             localStreamRef.current = stream;
//             remoteStreamRef.current = new MediaStream();

//             if (localVideoRef.current) {
//                 localVideoRef.current.srcObject = stream;
//             }
//             if (remoteVideoRef.current) {
//                 remoteVideoRef.current.srcObject = remoteStreamRef.current;
//             }

//             setButtonsState({
//                 camera: false,
//                 create: true,
//                 join: true,
//                 hangup: false
//             });
//             updateStatus('Camera and microphone ready!', 'connected');
//         } catch (error: any) {
//             console.error('Error accessing media devices:', error);
//             updateStatus(`Error: ${error.message}`, 'disconnected');
//             alert(`Cannot access camera/microphone: ${error.message}\n\nPlease make sure you have granted the necessary permissions.`);
//         }
//     };

//     // Setup peer connection
//     const setupPeerConnection = () => {
//         if (pcRef.current) {
//             pcRef.current.close();
//         }

//         const pc = new RTCPeerConnection(servers);
//         pcRef.current = pc;

//         // Add local tracks to connection
//         if (localStreamRef.current) {
//             localStreamRef.current.getTracks().forEach(track => {
//                 pc.addTrack(track, localStreamRef.current!);
//             });
//         }

//         // Handle incoming remote tracks
//         pc.ontrack = (event) => {
//             if (event.streams && event.streams[0]) {
//                 event.streams[0].getTracks().forEach(track => {
//                     if (remoteStreamRef.current && !remoteStreamRef.current.getTracks().some(t => t.id === track.id)) {
//                         remoteStreamRef.current.addTrack(track);
//                     }
//                 });
//             }
//         };

//         // Monitor connection state
//         pc.onconnectionstatechange = () => {
//             console.log('Connection state:', pc.connectionState);

//             switch (pc.connectionState) {
//                 case 'connected':
//                     updateStatus('✅ Connected!', 'connected');
//                     setButtonsState(prev => ({ ...prev, hangup: true }));
//                     break;
//                 case 'disconnected':
//                 case 'failed':
//                     updateStatus('❌ Connection lost', 'disconnected');
//                     break;
//                 case 'closed':
//                     updateStatus('Call ended', 'disconnected');
//                     break;
//             }
//         };

//         // Monitor ICE connection state
//         pc.oniceconnectionstatechange = () => {
//             console.log('ICE connection state:', pc.iceConnectionState);
//         };

//         // Handle ICE gathering state
//         pc.onicegatheringstatechange = () => {
//             console.log('ICE gathering state:', pc.iceGatheringState);
//         };

//         return pc;
//     };

//     // Setup Firestore listeners for ICE candidates
//     const setupFirestoreListeners = async (roomDocRef: any, isCaller: boolean) => {
//         const pc = pcRef.current;
//         if (!pc) return;

//         const callerCol = collection(roomDocRef, 'callerCandidates');
//         const calleeCol = collection(roomDocRef, 'calleeCandidates');
//         const targetCol = isCaller ? calleeCol : callerCol;

//         // Listen for ICE candidates from the other peer
//         const unsubscribe = onSnapshot(targetCol, (snapshot) => {
//             snapshot.docChanges().forEach((change) => {
//                 if (change.type === 'added') {
//                     const candidate = new RTCIceCandidate(change.doc.data());
//                     pc.addIceCandidate(candidate).catch((error) => {
//                         console.warn('Failed to add ICE candidate:', error);
//                     });
//                 }
//             });
//         });

//         // Send our ICE candidates to Firestore
//         pc.onicecandidate = (event) => {
//             if (event.candidate) {
//                 const candidateCol = isCaller ? callerCol : calleeCol;
//                 setDoc(doc(candidateCol), event.candidate.toJSON());
//             }
//         };

//         unsubscribeRef.current = unsubscribe;
//     };

//     // Create a new room
//     const createRoom = async () => {
//         try {
//             updateStatus('Creating room...', 'waiting');

//             // Setup peer connection
//             setupPeerConnection();
//             const pc = pcRef.current!;

//             // Create room document
//             const roomDocRef = doc(collection(db, 'rooms'));
//             const newRoomId = roomDocRef.id;

//             // Setup Firestore listeners (caller side)
//             await setupFirestoreListeners(roomDocRef, true);

//             // Create and set local description
//             const offer = await pc.createOffer({
//                 offerToReceiveAudio: true,
//                 offerToReceiveVideo: true
//             });
//             await pc.setLocalDescription(offer);

//             // Save offer to Firestore
//             await setDoc(roomDocRef, {
//                 offer: {
//                     type: offer.type,
//                     sdp: offer.sdp
//                 },
//                 createdAt: serverTimestamp(),
//                 creator: 'caller'
//             });

//             setRoomId(newRoomId);
//             setShowRoomId(true);
//             updateStatus('Room created! Waiting for peer to join...', 'waiting');

//             // Listen for answer from callee
//             const unsubscribe = onSnapshot(roomDocRef, (snapshot) => {
//                 const data = snapshot.data();
//                 if (data?.answer && !pc.currentRemoteDescription) {
//                     pc.setRemoteDescription(new RTCSessionDescription(data.answer));
//                     updateStatus('Peer joined! Connecting...', 'connected');
//                 }
//             });

//             roomUnsubscribeRef.current = unsubscribe;
//         } catch (error: any) {
//             console.error('Error creating room:', error);
//             updateStatus(`Error: ${error.message}`, 'disconnected');
//             alert(`Failed to create room: ${error.message}`);
//         }
//     };

//     // Join an existing room
//     const joinRoom = async () => {
//         const inputRoomId = joinRoomInput.trim();

//         if (!inputRoomId) {
//             alert('Please enter a Room ID');
//             return;
//         }

//         try {
//             updateStatus('Joining room...', 'waiting');

//             const roomDocRef = doc(db, 'rooms', inputRoomId);
//             const snapshot = await getDoc(roomDocRef);

//             if (!snapshot.exists()) {
//                 alert('Room not found! Please check the Room ID and try again.');
//                 updateStatus('Room not found', 'disconnected');
//                 return;
//             }

//             const data = snapshot.data();

//             if (!data.offer) {
//                 alert('Invalid room data!');
//                 return;
//             }

//             // Check if room is too old (more than 1 hour)
//             const createdAt = data.createdAt as Timestamp;
//             if (createdAt && (Date.now() - createdAt.toDate().getTime() > 3600000)) {
//                 alert('This room has expired. Please create a new room.');
//                 return;
//             }

//             // Setup peer connection
//             setupPeerConnection();
//             const pc = pcRef.current!;

//             // Setup Firestore listeners (callee side)
//             await setupFirestoreListeners(roomDocRef, false);

//             // Set remote description from offer
//             await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

//             // Create and set local description (answer)
//             const answer = await pc.createAnswer();
//             await pc.setLocalDescription(answer);

//             // Send answer to Firestore
//             await updateDoc(roomDocRef, {
//                 answer: {
//                     type: answer.type,
//                     sdp: answer.sdp
//                 },
//                 joinedAt: serverTimestamp()
//             });

//             // Close dialog
//             setJoinDialogOpen(false);
//             setRoomId(inputRoomId);
//             updateStatus('Connecting to peer...', 'waiting');
//         } catch (error: any) {
//             console.error('Error joining room:', error);
//             updateStatus(`Error: ${error.message}`, 'disconnected');

//             if (error.message.includes('failed to execute') || error.message.includes('InvalidAccessError')) {
//                 alert('Failed to join room. The room might be invalid or already in use.');
//             } else {
//                 alert(`Failed to join room: ${error.message}`);
//             }
//         }
//     };

//     // Cleanup function
//     const cleanup = async () => {
//         updateStatus('Cleaning up...', 'waiting');

//         // Unsubscribe from Firestore listeners
//         if (unsubscribeRef.current) {
//             unsubscribeRef.current();
//             unsubscribeRef.current = null;
//         }
//         if (roomUnsubscribeRef.current) {
//             roomUnsubscribeRef.current();
//             roomUnsubscribeRef.current = null;
//         }

//         // Close peer connection
//         if (pcRef.current) {
//             pcRef.current.close();
//             pcRef.current = null;
//         }

//         // Stop local tracks
//         if (localStreamRef.current) {
//             localStreamRef.current.getTracks().forEach(track => track.stop());
//             localStreamRef.current = null;
//         }

//         // Stop remote tracks
//         if (remoteStreamRef.current) {
//             remoteStreamRef.current.getTracks().forEach(track => track.stop());
//             remoteStreamRef.current = null;
//         }

//         // Clear video elements
//         if (localVideoRef.current) {
//             localVideoRef.current.srcObject = null;
//         }
//         if (remoteVideoRef.current) {
//             remoteVideoRef.current.srcObject = null;
//         }

//         // Clean up Firestore room data
//         if (roomId) {
//             try {
//                 const roomDocRef = doc(db, 'rooms', roomId);

//                 // Delete all candidates
//                 const [callerCandidates, calleeCandidates] = await Promise.all([
//                     getDocs(collection(roomDocRef, 'callerCandidates')),
//                     getDocs(collection(roomDocRef, 'calleeCandidates'))
//                 ]);

//                 const deletePromises: Promise<void>[] = [];
//                 callerCandidates.forEach(doc => deletePromises.push(deleteDoc(doc.ref)));
//                 calleeCandidates.forEach(doc => deletePromises.push(deleteDoc(doc.ref)));

//                 await Promise.all(deletePromises);
//                 await deleteDoc(roomDocRef);
//             } catch (error) {
//                 console.warn('Error cleaning up Firestore:', error);
//             }
//         }

//         // Reset UI
//         setShowRoomId(false);
//         setRoomId(null);
//         setButtonsState({
//             camera: true,
//             create: false,
//             join: false,
//             hangup: false
//         });

//         updateStatus('Call ended. Start camera to begin again.', 'disconnected');
//     };

//     // Copy room ID to clipboard
//     const copyRoomId = async () => {
//         if (!roomId) return;

//         try {
//             await navigator.clipboard.writeText(roomId);
//             alert('Room ID copied to clipboard!');
//         } catch (err) {
//             console.error('Failed to copy:', err);
//             alert('Failed to copy Room ID');
//         }
//     };

//     // Cleanup on unmount
//     useEffect(() => {
//         return () => {
//             cleanup();
//         };
//     }, []);

//     return (
//         <div className="min-h-screen bg-gray-100 p-5">
//             <div className="max-w-4xl mx-auto">
//                 <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
//                     🎥 WebRTC Video Chat
//                 </h2>

//                 {/* Status Display */}
//                 <div
//                     className={`px-5 py-3 rounded-lg text-center font-medium mb-5 ${status.type === 'connected'
//                         ? 'bg-green-500 text-white'
//                         : status.type === 'disconnected'
//                             ? 'bg-red-500 text-white'
//                             : 'bg-orange-500 text-white'
//                         }`}
//                 >
//                     {status.text}
//                 </div>

//                 {/* Video Elements */}
//                 <div className="flex gap-5 mb-5 flex-wrap">
//                     <div className="flex-1 min-w-[280px]">
//                         <video
//                             ref={localVideoRef}
//                             autoPlay
//                             muted
//                             playsInline
//                             className="w-full h-72 bg-black rounded-lg shadow-lg transform scale-x-[-1]"
//                         />
//                         <div className="text-center mt-2 font-medium text-gray-600">
//                             You (Local)
//                         </div>
//                     </div>
//                     <div className="flex-1 min-w-[280px]">
//                         <video
//                             ref={remoteVideoRef}
//                             autoPlay
//                             playsInline
//                             className="w-full h-72 bg-black rounded-lg shadow-lg"
//                         />
//                         <div className="text-center mt-2 font-medium text-gray-600">
//                             Remote Peer
//                         </div>
//                     </div>
//                 </div>

//                 {/* Control Buttons */}
//                 <div className="flex gap-3 mb-5 flex-wrap">
//                     <button
//                         onClick={openMedia}
//                         disabled={!buttonsState.camera}
//                         className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
//                     >
//                         📷 Start Camera
//                     </button>
//                     <button
//                         onClick={createRoom}
//                         disabled={!buttonsState.create}
//                         className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
//                     >
//                         ➕ Create Room
//                     </button>
//                     <button
//                         onClick={() => setJoinDialogOpen(true)}
//                         disabled={!buttonsState.join}
//                         className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
//                     >
//                         🚪 Join Room
//                     </button>
//                     <button
//                         onClick={cleanup}
//                         disabled={!buttonsState.hangup}
//                         className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
//                     >
//                         📞 Hang Up
//                     </button>
//                 </div>

//                 {/* Room ID Display */}
//                 {showRoomId && (
//                     <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-6 rounded-xl shadow-xl animate-fadeIn">
//                         <h3 className="text-xl font-bold mb-4">
//                             📋 Room ID (Share this with your friend)
//                         </h3>
//                         <div className="bg-white/15 p-4 rounded-lg mb-4 font-mono text-center text-lg break-all">
//                             {roomId}
//                         </div>
//                         <button
//                             onClick={copyRoomId}
//                             className="w-full px-6 py-3 bg-white text-purple-700 rounded-lg font-medium hover:bg-gray-100 transition"
//                         >
//                             📋 Copy Room ID
//                         </button>
//                     </div>
//                 )}

//                 {/* Join Room Dialog */}
//                 {joinDialogOpen && (
//                     <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
//                         <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
//                             <h2 className="text-2xl font-bold mb-4">Join Room</h2>
//                             <input
//                                 type="text"
//                                 value={joinRoomInput}
//                                 onChange={(e) => setJoinRoomInput(e.target.value)}
//                                 onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
//                                 placeholder="Enter Room ID"
//                                 className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-4 focus:border-indigo-500 focus:outline-none"
//                             />
//                             <div className="flex gap-3">
//                                 <button
//                                     onClick={() => setJoinDialogOpen(false)}
//                                     className="flex-1 px-6 py-3 bg-gray-300 text-gray-800 rounded-lg font-medium hover:bg-gray-400 transition"
//                                 >
//                                     Cancel
//                                 </button>
//                                 <button
//                                     onClick={joinRoom}
//                                     className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
//                                 >
//                                     Join
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// }



'use client';

import { useState, useRef, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    deleteDoc,
    getDocs,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// WebRTC STUN servers
const servers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" }
    ]
};

// Types
type StatusType = 'waiting' | 'connected' | 'disconnected';
interface ButtonsState {
    camera: boolean;
    create: boolean;
    join: boolean;
    hangup: boolean;
}

export default function VideoChat() {
    // State
    const [status, setStatus] = useState<{ text: string; type: StatusType }>({
        text: 'Ready to start! Click "Start Camera" to begin.',
        type: 'waiting'
    });
    const [roomId, setRoomId] = useState<string | null>(null);
    const [showRoomId, setShowRoomId] = useState(false);
    const [joinDialogOpen, setJoinDialogOpen] = useState(false);
    const [joinRoomInput, setJoinRoomInput] = useState('');
    const [buttonsState, setButtonsState] = useState<ButtonsState>({
        camera: true,
        create: false,
        join: false,
        hangup: false
    });

    // Screen share & recording state
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    // Refs
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const roomUnsubscribeRef = useRef<(() => void) | null>(null);

    const screenStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    // Helpers
    const updateStatus = (text: string, type: StatusType) => {
        setStatus({ text, type });
    };

    // Open camera & mic
    const openMedia = async () => {
        try {
            updateStatus('Accessing camera and microphone...', 'waiting');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });

            localStreamRef.current = stream;
            remoteStreamRef.current = new MediaStream();

            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;

            setButtonsState({ camera: false, create: true, join: true, hangup: false });
            updateStatus('Camera and microphone ready!', 'connected');
        } catch (error: any) {
            console.error('Error accessing media devices:', error);
            updateStatus(`Error: ${error.message}`, 'disconnected');
            alert(`Cannot access camera/microphone: ${error.message}`);
        }
    };

    // Peer connection setup
    const setupPeerConnection = () => {
        if (pcRef.current) pcRef.current.close();

        const pc = new RTCPeerConnection(servers);
        pcRef.current = pc;

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
        }

        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                event.streams[0].getTracks().forEach(track => {
                    if (remoteStreamRef.current && !remoteStreamRef.current.getTracks().some(t => t.id === track.id)) {
                        remoteStreamRef.current.addTrack(track);
                    }
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('Connection state:', pc.connectionState);
            switch (pc.connectionState) {
                case 'connected':
                    updateStatus('✅ Connected!', 'connected');
                    setButtonsState(prev => ({ ...prev, hangup: true }));
                    break;
                case 'disconnected':
                case 'failed':
                    updateStatus('❌ Connection lost', 'disconnected');
                    break;
                case 'closed':
                    updateStatus('Call ended', 'disconnected');
                    break;
            }
        };

        return pc;
    };

    // Firestore ICE listeners
    const setupFirestoreListeners = async (roomDocRef: any, isCaller: boolean) => {
        const pc = pcRef.current;
        if (!pc) return;

        const callerCol = collection(roomDocRef, 'callerCandidates');
        const calleeCol = collection(roomDocRef, 'calleeCandidates');
        const targetCol = isCaller ? calleeCol : callerCol;

        const unsubscribe = onSnapshot(targetCol, snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pc.addIceCandidate(candidate).catch(err => console.warn(err));
                }
            });
        });

        pc.onicecandidate = event => {
            if (event.candidate) {
                const candidateCol = isCaller ? callerCol : calleeCol;
                setDoc(doc(candidateCol), event.candidate.toJSON());
            }
        };

        unsubscribeRef.current = unsubscribe;
    };

    // Create room
    const createRoom = async () => {
        try {
            updateStatus('Creating room...', 'waiting');
            setupPeerConnection();
            const pc = pcRef.current!;
            const roomDocRef = doc(collection(db, 'rooms'));
            const newRoomId = roomDocRef.id;

            await setupFirestoreListeners(roomDocRef, true);

            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
            await pc.setLocalDescription(offer);

            await setDoc(roomDocRef, { offer: { type: offer.type, sdp: offer.sdp }, createdAt: serverTimestamp(), creator: 'caller' });

            setRoomId(newRoomId);
            setShowRoomId(true);
            updateStatus('Room created! Waiting for peer...', 'waiting');

            roomUnsubscribeRef.current = onSnapshot(roomDocRef, snapshot => {
                const data = snapshot.data();
                if (data?.answer && !pc.currentRemoteDescription) {
                    pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                    updateStatus('Peer joined! Connecting...', 'connected');
                }
            });
        } catch (error: any) {
            console.error(error);
            updateStatus(`Error: ${error.message}`, 'disconnected');
        }
    };

    // Join room
    const joinRoom = async () => {
        const inputRoomId = joinRoomInput.trim();
        if (!inputRoomId) return alert('Enter Room ID');

        try {
            updateStatus('Joining room...', 'waiting');
            const roomDocRef = doc(db, 'rooms', inputRoomId);
            const snapshot = await getDoc(roomDocRef);

            if (!snapshot.exists()) {
                updateStatus('Room not found', 'disconnected');
                return alert('Room not found!');
            }

            const data = snapshot.data();
            if (!data.offer) return alert('Invalid room data');

            const createdAt = data.createdAt as Timestamp;
            if (createdAt && (Date.now() - createdAt.toDate().getTime() > 3600000)) {
                return alert('Room expired.');
            }

            setupPeerConnection();
            const pc = pcRef.current!;
            await setupFirestoreListeners(roomDocRef, false);

            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await updateDoc(roomDocRef, { answer: { type: answer.type, sdp: answer.sdp }, joinedAt: serverTimestamp() });

            setJoinDialogOpen(false);
            setRoomId(inputRoomId);
            updateStatus('Connecting to peer...', 'waiting');
        } catch (error: any) {
            console.error(error);
            updateStatus(`Error: ${error.message}`, 'disconnected');
        }
    };

    // Screen share
    const startScreenShare = async () => {
        if (!pcRef.current || !localStreamRef.current) return;

        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;

        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(screenStream.getVideoTracks()[0]);

        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;

        screenStream.getVideoTracks()[0].onended = stopScreenShare;
        setIsScreenSharing(true);
    };

    const stopScreenShare = () => {
        if (!pcRef.current || !localStreamRef.current) return;

        const cameraTrack = localStreamRef.current.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(cameraTrack);

        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;

        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
    };

    // Recording
    const startRecording = () => {
        if (!localStreamRef.current || !remoteStreamRef.current) return;

        const combinedStream = new MediaStream([
            ...localStreamRef.current.getTracks(),
            ...remoteStreamRef.current.getTracks()
        ]);

        const recorder = new MediaRecorder(combinedStream);
        mediaRecorderRef.current = recorder;
        recordedChunksRef.current = [];

        recorder.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
        recorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `recording-${Date.now()}.webm`;
            a.click();
            URL.revokeObjectURL(url);
        };

        recorder.start();
        setIsRecording(true);
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    // Cleanup
    const cleanup = async () => {
        updateStatus('Cleaning up...', 'waiting');

        if (unsubscribeRef.current) { unsubscribeRef.current(); unsubscribeRef.current = null; }
        if (roomUnsubscribeRef.current) { roomUnsubscribeRef.current(); roomUnsubscribeRef.current = null; }

        if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }

        if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
        if (remoteStreamRef.current) { remoteStreamRef.current.getTracks().forEach(t => t.stop()); remoteStreamRef.current = null; }
        if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }

        if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();

        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

        if (roomId) {
            try {
                const roomDocRef = doc(db, 'rooms', roomId);
                const [callerCandidates, calleeCandidates] = await Promise.all([
                    getDocs(collection(roomDocRef, 'callerCandidates')),
                    getDocs(collection(roomDocRef, 'calleeCandidates'))
                ]);
                await Promise.all([...callerCandidates.docs.map(d => deleteDoc(d.ref)), ...calleeCandidates.docs.map(d => deleteDoc(d.ref))]);
                await deleteDoc(roomDocRef);
            } catch (err) { console.warn(err); }
        }

        setShowRoomId(false);
        setRoomId(null);
        setButtonsState({ camera: true, create: false, join: false, hangup: false });
        setIsScreenSharing(false);
        setIsRecording(false);

        updateStatus('Call ended. Start camera to begin again.', 'disconnected');
    };

    // Copy room
    const copyRoomId = async () => {
        if (!roomId) return;
        try { await navigator.clipboard.writeText(roomId); alert('Room ID copied!'); }
        catch { alert('Failed to copy Room ID'); }
    };

    useEffect(() => {
        return () => {
            (async () => {
                await cleanup();
            })();
        };
    }, []);

    return (
        <div className="min-h-screen bg-gray-100 p-5">
            <div className="max-w-4xl mx-auto">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">🎥 WebRTC Video Chat</h2>

                {/* Status */}
                <div className={`px-5 py-3 rounded-lg text-center font-medium mb-5 ${status.type === 'connected' ? 'bg-green-500 text-white' : status.type === 'disconnected' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                    {status.text}
                </div>

                {/* Videos */}
                <div className="flex gap-5 mb-5 flex-wrap">
                    <div className="flex-1">
                        <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-72 bg-black rounded-lg shadow-lg transform scale-x-[-1]" />
                        <div className="text-center mt-2 font-medium text-gray-600">You (Local)</div>
                    </div>
                    <div className="flex-1">
                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-72 bg-black rounded-lg shadow-lg" />
                        <div className="text-center mt-2 font-medium text-gray-600">Remote Peer</div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex gap-3 mb-5 flex-wrap">
                    <button onClick={openMedia} disabled={!buttonsState.camera} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400">📷 Start Camera</button>
                    <button onClick={createRoom} disabled={!buttonsState.create} className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400">➕ Create Room</button>
                    <button onClick={() => setJoinDialogOpen(true)} disabled={!buttonsState.join} className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400">🚪 Join Room</button>
                    <button onClick={cleanup} disabled={!buttonsState.hangup} className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400">📞 Hang Up</button>
                </div>

                {/* Screen share & Recording */}
                <div className="flex gap-3 mb-5 flex-wrap">
                    <button onClick={isScreenSharing ? stopScreenShare : startScreenShare} disabled={!pcRef.current} className="px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-400">🖥️ {isScreenSharing ? 'Stop Share' : 'Share Screen'}</button>
                    <button onClick={isRecording ? stopRecording : startRecording} disabled={!pcRef.current} className={`px-6 py-3 rounded-lg font-medium text-white ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>⏺️ {isRecording ? 'Stop Recording' : 'Start Recording'}</button>
                </div>

                {/* Room ID */}
                {showRoomId && (
                    <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-6 rounded-xl shadow-xl animate-fadeIn">
                        <h3 className="text-xl font-bold mb-4">📋 Room ID</h3>
                        <div className="bg-white/15 p-4 rounded-lg mb-4 font-mono text-center text-lg break-all">{roomId}</div>
                        <button onClick={copyRoomId} className="w-full px-6 py-3 bg-white text-purple-700 rounded-lg font-medium hover:bg-gray-100">📋 Copy Room ID</button>
                    </div>
                )}

                {/* Join Room Dialog */}
                {joinDialogOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                            <h2 className="text-2xl font-bold mb-4">Join Room</h2>
                            <input type="text" value={joinRoomInput} onChange={(e) => setJoinRoomInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && joinRoom()} placeholder="Enter Room ID" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg mb-4 focus:border-indigo-500 focus:outline-none" />
                            <div className="flex gap-3">
                                <button onClick={() => setJoinDialogOpen(false)} className="flex-1 px-6 py-3 bg-gray-300 text-gray-800 rounded-lg font-medium hover:bg-gray-400">Cancel</button>
                                <button onClick={joinRoom} className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Join</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
