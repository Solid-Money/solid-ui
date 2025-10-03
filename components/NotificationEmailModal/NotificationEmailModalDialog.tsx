import ResponsiveModal from '@/components/ResponsiveModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import React from 'react';
import { Platform, View } from 'react-native';
import NotificationEmailModal from './index';

interface NotificationEmailModalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export const NotificationEmailModalDialog: React.FC<NotificationEmailModalDialogProps> = ({
    open,
    onOpenChange,
    onSuccess,
}) => {
    console.log('NotificationEmailModalDialog render', { open, platform: Platform.OS });
    if (Platform.OS === 'web') {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="sr-only">Email Required</DialogTitle>
                    </DialogHeader>
                    <View className="p-6">
                        <NotificationEmailModal
                            onSuccess={onSuccess}
                        />
                    </View>
                </DialogContent>
            </Dialog>
        );
    }

    // For native, we need to create a modal state
    const notificationModalState = {
        name: 'notification-email-modal',
        number: 1
    };
    const closedModalState = {
        name: 'close',
        number: 0
    };
    
    return (
        <ResponsiveModal
            isOpen={open}
            onOpenChange={onOpenChange}
            currentModal={open ? notificationModalState : closedModalState}
            previousModal={closedModalState}
            trigger={null} // No trigger as we control open state externally
            title="Email Required"
            titleClassName="justify-center"
            contentKey="notification-email-modal"
        >
            <View className="p-6">
                <NotificationEmailModal
                    onSuccess={onSuccess}
                />
            </View>
        </ResponsiveModal>
    );
};
