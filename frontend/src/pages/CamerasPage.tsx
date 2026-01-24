import { useState } from 'react'
import { Video } from 'lucide-react'
import CameraList from '../components/CameraList'
import CameraForm from '../components/CameraForm'
import type { Camera } from '../types'

export default function CamerasPage() {
    const [view, setView] = useState<'list' | 'form'>('list')
    const [editingCamera, setEditingCamera] = useState<Camera | undefined>(undefined)

    const handleEditCamera = (camera: Camera) => {
        setEditingCamera(camera)
        setView('form')
    }

    const handleAddCamera = () => {
        setEditingCamera(undefined)
        setView('form')
    }

    const handleSaveCamera = () => {
        setView('list')
        setEditingCamera(undefined)
    }

    return (
        <div className="h-full flex flex-col gap-6">
            <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <Video className="w-5 h-5 text-techno-500" />
                    Camera Management
                </h1>
                <p className="text-sm text-stone-400 mt-1">Configure and manage your surveillance cameras</p>
            </div>

            <div className="flex-1 overflow-auto animate-in fade-in duration-300">
                {view === 'list' ? (
                    <CameraList onEdit={handleEditCamera} onAdd={handleAddCamera} />
                ) : (
                    <CameraForm
                        camera={editingCamera}
                        onSave={handleSaveCamera}
                        onCancel={() => {
                            setView('list')
                            setEditingCamera(undefined)
                        }}
                    />
                )}
            </div>
        </div>
    )
}
