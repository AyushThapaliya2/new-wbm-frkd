import time
from datetime import datetime, timedelta

class WorkTracker:
    def __init__(self, hourly_rate):
        self.hourly_rate = hourly_rate
        self.total_time = 0
        self.total_earnings = 0
        self.total_tasks = 0
        self.start_time = None
        self.current_earnings = 0

    def start_task(self):
        if self.start_time is None:
            self.start_time = datetime.now()
            print(f"Task started at {self.start_time}")
        else:
            print("Task is already running")

    def end_task(self):
        if self.start_time is not None:
            end_time = datetime.now()
            task_duration = (end_time - self.start_time).total_seconds() / 3600  # Convert to hours
            self.total_time += task_duration
            self.total_earnings += task_duration * self.hourly_rate
            self.total_tasks += round(task_duration / 0.5)  # Assume 30 minutes per task
            self.start_time = None
            print(f"Task ended at {end_time}")
            print(f"Duration: {task_duration * 60:.2f} minutes")
        else:
            print("No task is running")

    def show_info(self):
        print(f"Total time worked: {self.total_time * 60:.2f} minutes")
        print(f"Total earnings: ${self.total_earnings:.2f}")
        print(f"Total tasks completed: {self.total_tasks}")

    def set_current_earnings(self, earnings):
        self.current_earnings = earnings
        print(f"Current earnings set to ${self.current_earnings:.2f}")

    def calculate_next_task_start(self):
        if self.start_time is None:
            next_task_start = datetime.now() + timedelta(minutes=45)
            print(f"Next task should start at {next_task_start}")
        else:
            print("Task is currently running")

# Example usage
if __name__ == "__main__":
    tracker = WorkTracker(hourly_rate=42)
    while True:
        print("\n1. Start Task\n2. End Task\n3. Show Info\n4. Set Current Earnings\n5. Calculate Next Task Start\n6. Exit")
        choice = input("Enter your choice: ")
        if choice == "1":
            tracker.start_task()
        elif choice == "2":
            tracker.end_task()
        elif choice == "3":
            tracker.show_info()
        elif choice == "4":
            earnings = float(input("Enter current earnings: "))
            tracker.set_current_earnings(earnings)
        elif choice == "5":
            tracker.calculate_next_task_start()
        elif choice == "6":
            break
        else:
            print("Invalid choice. Please try again.")
