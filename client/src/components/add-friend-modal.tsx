import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

const emailFriendSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const manualFriendSchema = z.object({
  displayName: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
});

type EmailFriendFormValues = z.infer<typeof emailFriendSchema>;
type ManualFriendFormValues = z.infer<typeof manualFriendSchema>;

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFriendModal({ isOpen, onClose }: AddFriendModalProps) {
  const { toast } = useToast();
  
  const emailForm = useForm<EmailFriendFormValues>({
    resolver: zodResolver(emailFriendSchema),
    defaultValues: {
      email: "",
    },
  });

  const manualForm = useForm<ManualFriendFormValues>({
    resolver: zodResolver(manualFriendSchema),
    defaultValues: {
      displayName: "",
      phone: "",
    },
  });

  const addFriendByEmailMutation = useMutation({
    mutationFn: async (data: EmailFriendFormValues) => {
      const response = await apiRequest("POST", "/api/friends/email", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Friend request sent",
        description: "An invitation has been sent to your friend.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      emailForm.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addFriendManuallyMutation = useMutation({
    mutationFn: async (data: ManualFriendFormValues) => {
      const response = await apiRequest("POST", "/api/friends/manual", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Friend added",
        description: "Your friend has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      manualForm.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add friend",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add a friend</DialogTitle>
        </DialogHeader>
        
        <Form {...emailForm}>
          <form onSubmit={emailForm.handleSubmit((data) => addFriendByEmailMutation.mutate(data))} className="space-y-4">
            <FormField
              control={emailForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Enter email address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="friend@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={addFriendByEmailMutation.isPending}>
              {addFriendByEmailMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending invitation...
                </>
              ) : (
                "Send Invitation"
              )}
            </Button>
          </form>
        </Form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-2 text-sm text-muted-foreground">
              or
            </span>
          </div>
        </div>

        <Form {...manualForm}>
          <form onSubmit={manualForm.handleSubmit((data) => addFriendManuallyMutation.mutate(data))} className="space-y-4">
            <FormField
              control={manualForm.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={manualForm.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone number (optional)</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+1 (555) 123-4567" {...field} />
                  </FormControl>
                  <FormDescription>We'll send them an invitation to join Splitica.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="mt-6">
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={addFriendManuallyMutation.isPending}>
                {addFriendManuallyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Friend"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
